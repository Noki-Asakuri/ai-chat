import { auth } from "@clerk/nextjs/server";
import { Redis } from "ioredis";
import { after, NextResponse, type NextRequest } from "next/server";
import { createResumableStreamContext } from "resumable-stream/ioredis";

import { logger, withAxiom } from "@/lib/axiom/server";

import { env } from "@/env";

const publisher = new Redis(env.REDIS_URL);
const subscriber = new Redis(env.REDIS_URL);

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

  const url =
    env.NODE_ENV === "production"
      ? "https://api.chat.asakuri.me/api/ai/chat"
      : "http://localhost:3001/api/ai/chat";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
      "X-User-Id": user.userId,
    },
    body: await req.text(),
  });

  return new Response(response.body, { status: response.status, headers: response.headers });
});

export const GET = withAxiom(async (req: NextRequest) => {
  const user = await auth();

  if (!user.userId) {
    logger.error("[Chat Error]: Unauthenticated GET request!");
    return NextResponse.json({ error: { message: "Error: Unauthenticated!" } }, { status: 401 });
  }

  const streamId = req.nextUrl.searchParams.get("streamId");
  const resumeAt = req.nextUrl.searchParams.get("resumeAt");

  if (!streamId) {
    logger.error("[Chat Error]: Missing streamId!", { streamId, resumeAt });
    return Response.json({ error: { message: "Missing streamId" } }, { status: 400 });
  }

  logger.info("[Chat] Resuming chat streaming!", { streamId, resumeAt, userId: user.userId });

  const stream = await streamContext.resumeExistingStream(
    streamId,
    resumeAt ? parseInt(resumeAt) : undefined,
  );
  return new Response(stream, {
    headers: {
      connection: "keep-alive",
      "Cache-Control": "no-cache",
      "Transfer-Encoding": "chunked",
      "Content-Type": "text/event-stream",
    },
  });
});
