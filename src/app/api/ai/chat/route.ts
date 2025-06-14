import { env } from "@/env";

import { api } from "@/convex/_generated/api";
import { serverConvexClient } from "@/lib/convex/server";

import { auth } from "@clerk/nextjs/server";
import { waitUntil } from "@vercel/functions";
import { Redis } from "ioredis";
import { after, NextResponse, type NextRequest } from "next/server";
import { createResumableStreamContext } from "resumable-stream/ioredis";

import { generateId, streamText, type AISDKError } from "ai";

import { getRequestBody } from "@/lib/server/get-request-body";
import { registry } from "@/lib/server/model-registry";
import { updateTitle } from "@/lib/server/update-title";
import { tryCatch } from "@/lib/utils";

const publisher = new Redis(env.REDIS_URL);
const subscriber = new Redis(env.REDIS_URL);

const streamContext = createResumableStreamContext({
  waitUntil: after,
  publisher: publisher,
  subscriber: subscriber,
});

export async function POST(req: Request) {
  const user = await auth();

  if (!user.userId) {
    return NextResponse.json({ error: { message: "Error: Unauthenticated!" } }, { status: 401 });
  }
  const authToken = await user.getToken({ template: "convex" });
  if (!authToken) {
    return NextResponse.json(
      { error: { message: "Error: Missing Convex auth token!" } },
      { status: 401 },
    );
  }
  serverConvexClient.setAuth(authToken);

  const [data, error] = await tryCatch(() => getRequestBody(req, user.userId));
  if (error) {
    return NextResponse.json({ error: { message: error.message } }, { status: 400 });
  }

  const {
    messages,
    transformedMessages,
    assistantMessageId,
    threadId,
    model,
    providerOptions,
    config,
  } = data;

  const startTime = Date.now();
  const result = streamText({
    model: registry.languageModel(model),
    system: "You are a helpful assistant.",
    messages: transformedMessages,
    providerOptions,
    abortSignal: req.signal,

    topP: config.topP,
    topK: config.topK,
    temperature: config.temperature,
    maxOutputTokens: config.maxTokens,
    presencePenalty: config.presencePenalty,
    frequencyPenalty: config.frequencyPenalty,

    async onError({ error }) {
      const err = error as AISDKError;
      console.error("[Chat] Error:", err);

      if (err.name === "AbortError" && req.signal.aborted) return;
      await serverConvexClient.mutation(api.messages.updateErrorMessage, {
        messageId: assistantMessageId,
        error: err.message,
      });
    },
  });

  const streamId = generateId();
  await serverConvexClient.mutation(api.messages.updateMessageById, {
    threadId,
    messageId: assistantMessageId,
    updates: { status: "streaming", resumableStreamId: streamId },
  });

  const metadata = {
    model,
    duration: 0,
    finishReason: "",
    totalTokens: 0,
    thinkingTokens: 0,
    providerOptions: undefined,
  } as {
    model: string;
    duration: number;
    finishReason: string;
    totalTokens: number;
    thinkingTokens: number;
    // providerOptions?: { openai: Record<string, JSONValue>; google: GoogleGenerativeAIProviderMetadata };
  };

  const reader = result
    .toUIMessageStream({
      sendFinish: true,
      sendReasoning: true,
      sendSources: true,
      sendStart: true,
      messageMetadata({ part }): Partial<typeof metadata> | undefined {
        if (part.type === "finish-step") {
          metadata.model = part.response.modelId;
          metadata.duration = Date.now() - startTime;
          metadata.finishReason = part.finishReason;
          // metadata.providerOptions = part.providerMetadata as (typeof metadata)["providerOptions"];
        }

        if (part.type === "finish") {
          metadata.totalTokens = part.totalUsage.outputTokens ?? 0;
          metadata.thinkingTokens = part.totalUsage.reasoningTokens ?? 0;

          return metadata;
        }
      },
    })
    .getReader();

  let content = "";
  let reasoning = "";
  const sources: { id: string; title?: string; url: string }[] = [];

  const readableStream = new ReadableStream<string>({
    async start(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done || req.signal.aborted) break;
        controller.enqueue("data: " + JSON.stringify(value) + "\n\n");

        switch (value.type) {
          case "text":
            content += value.text;
            break;

          case "reasoning":
            reasoning += value.text;
            break;

          case "source-url":
            sources.push({ id: value.sourceId, title: value.title, url: value.url });
            break;

          default:
            console.log(value);
            break;
        }
      }

      const updates = {
        model,
        content,
        metadata,
        resumableStreamId: null,
        status: "complete" as const,
        reasoning: reasoning.length > 0 ? reasoning.trim() : undefined,
      };

      if (!req.signal.aborted) {
        await serverConvexClient.mutation(api.messages.updateMessageById, {
          messageId: assistantMessageId,
          threadId,
          updates,
        });

        controller.enqueue("data: [DONE]\n\n");
      }

      return controller.close();
    },
  });

  const resumeableStream = await streamContext.resumableStream(streamId, () => readableStream);
  waitUntil(updateTitle(messages, threadId));

  req.signal.onabort = async () => {
    await reader.cancel(new Error("Request aborted"));
  };

  return new Response(resumeableStream, {
    headers: {
      connection: "keep-alive",
      "Cache-Control": "no-cache",
      "Transfer-Encoding": "chunked",
      "Content-Type": "text/event-stream",
    },
  });
}

export async function GET(req: NextRequest) {
  const streamId = req.nextUrl.searchParams.get("streamId");
  const resumeAt = req.nextUrl.searchParams.get("resumeAt");

  if (!streamId) {
    return Response.json({ error: { message: "Missing streamId" } }, { status: 400 });
  }

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
}
