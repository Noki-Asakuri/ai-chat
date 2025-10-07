import { api } from "@/convex/_generated/api";

import { auth } from "@clerk/nextjs/server";
import { waitUntil } from "@vercel/functions";
import { consumeStream } from "ai";
import { Redis } from "ioredis";
import { after, NextResponse, type NextRequest } from "next/server";
import { createResumableStreamContext } from "resumable-stream/ioredis";

import { env } from "@/env";
import { logger, withAxiom } from "@/lib/axiom/server";
import { serverConvexClient } from "@/lib/convex/server";
import type { RequestBody } from "@/lib/types";
import { tryCatch } from "@/lib/utils";

const publisher = new Redis(env.REDIS_URL);
const subscriber = publisher.duplicate();

const streamContext = createResumableStreamContext({
  waitUntil: after,
  publisher: publisher,
  subscriber: subscriber,
  keyPrefix: `${env.NODE_ENV}:resumable-stream`,
});

export const POST = withAxiom(async (req) => {
  const user = await auth();
  if (!user.userId) {
    logger.error("[Chat Error]: Unauthenticated POST request!", { user });
    return NextResponse.json({ error: { message: "Error: Unauthenticated!" } }, { status: 401 });
  }

  const authToken = await user.getToken({ template: "convex" });
  serverConvexClient.setAuth(authToken!);

  console.log("[Chat] Proxying chat request to", env.API_ENDPOINT);
  logger.info("[Chat] Proxying chat request to", { userId: user.userId });

  const [body, bodyError] = await tryCatch((await req.json()) as Promise<RequestBody>);
  if (bodyError) {
    logger.error("[Chat Error]: Failed to parse request body!", { error: bodyError });
    return NextResponse.json(
      { error: { message: "Failed to parse request body!" } },
      { status: 400 },
    );
  }

  const response = await fetch(env.API_ENDPOINT, {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
      "X-User-Id": user.userId,
    },
  });

  const requestId = response.headers.get("X-Request-Id")!;
  const contentType = response.headers.get("Content-Type")!;

  const obj = { userId: user.userId, status: response.status, contentType, requestId };

  console.log("[Chat] Response received", obj);
  logger.info("[Chat] Response received", obj);

  if (response.ok || contentType === "text/event-stream") {
    const textDecoderStream = new TextDecoderStream("utf-8");
    const textStream = response.body!.pipeThrough(textDecoderStream);

    const [consumableStream, responseStream] = textStream.tee();
    waitUntil(consumeStream({ stream: consumableStream }));

    return new Response(responseStream, {
      status: response.status,
      headers: {
        connection: "keep-alive",
        "Cache-Control": "no-cache",
        "Transfer-Encoding": "chunked",
        "Content-Type": contentType,
      },
    });
  }

  const errorText = await response.text();
  logger.error("[Chat Error]: Received an error from the server!", {
    userId: user.userId,
    status: response.status,
    error: errorText,
  });

  const error = `Received an error from the server. Please notify the administrator. Status: ${response.status} - ${response.statusText}`;
  await serverConvexClient.mutation(api.functions.messages.updateErrorMessage, {
    messageId: body.assistantMessageId,
    model: body.config.model || "unknown",
    error: error,
  });

  return NextResponse.json({ error: { message: error } }, { status: 500 });
});

export const GET = withAxiom(async (req: NextRequest) => {
  const user = await auth();

  if (!user.userId) {
    logger.error("[Chat Error]: Unauthenticated GET request!");
    return new Response(null, { status: 204 });
  }

  const streamId = req.nextUrl.searchParams.get("streamId");
  const resumeAt = req.nextUrl.searchParams.get("resumeAt");

  if (!streamId) {
    logger.error("[Chat Error]: Missing streamId!", { streamId, resumeAt });
    return new Response(null, { status: 204 });
  }

  logger.info("[Chat] Resuming chat streaming!", { streamId, resumeAt, userId: user.userId });

  const stream = await streamContext.resumeExistingStream(
    streamId,
    resumeAt ? parseInt(resumeAt) : undefined,
  );

  if (!stream) {
    logger.error("[Chat Error]: Stream not found!", { streamId, resumeAt });
    return new Response(null, { status: 204 });
  }

  return new Response(stream, {
    headers: {
      connection: "keep-alive",
      "Cache-Control": "no-cache",
      "Transfer-Encoding": "chunked",
      "Content-Type": "text/event-stream",
    },
  });
});
