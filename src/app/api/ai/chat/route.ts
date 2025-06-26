import { api } from "@/convex/_generated/api";
import { serverConvexClient } from "@/lib/convex/server";

import { auth } from "@clerk/nextjs/server";
import { waitUntil } from "@vercel/functions";
import { Redis } from "ioredis";
import { after, NextResponse, type NextRequest } from "next/server";
import { createResumableStreamContext } from "resumable-stream/ioredis";
import { checkBotId } from "botid/server";

import { createUIMessageStream, generateId, streamText, type AISDKError } from "ai";

import { getRequestBody } from "@/lib/server/get-request-body";
import { registry } from "@/lib/server/model-registry";
import { getDistinctId, PostHogClient } from "@/lib/server/posthog";
import { updateTitle } from "@/lib/server/update-title";
import { tryCatch } from "@/lib/utils";

import { env } from "@/env";

const publisher = new Redis(env.REDIS_URL);
const subscriber = new Redis(env.REDIS_URL);

const streamContext = createResumableStreamContext({
  waitUntil: after,
  publisher: publisher,
  subscriber: subscriber,
});

export async function POST(req: Request) {
  const verification = await checkBotId();

  if (verification.isBot) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const user = await auth();

  const posthog = PostHogClient();
  const distinctId = getDistinctId(req);

  if (!user.userId) {
    posthog.capture({ distinctId, event: "chat_error", properties: { error: "Unauthenticated" } });
    return NextResponse.json({ error: { message: "Error: Unauthenticated!" } }, { status: 401 });
  }
  const authToken = await user.getToken({ template: "convex" });
  if (!authToken) {
    posthog.capture({
      distinctId,
      event: "chat_error",
      properties: { error: "Missing Convex auth token", userId: user.userId },
    });
    return NextResponse.json(
      { error: { message: "Error: Missing Convex auth token!" } },
      { status: 401 },
    );
  }
  serverConvexClient.setAuth(authToken);

  const [data, error] = await tryCatch(() => getRequestBody(req, user.userId));
  if (error) {
    posthog.capture({ distinctId, event: "chat_error", properties: { error: error.message } });
    return NextResponse.json({ error: { message: error.message } }, { status: 400 });
  }

  const dataCustomization = await serverConvexClient.query(api.users.currentUser);
  let systemInstruction = "";

  if (dataCustomization?.customization?.name) {
    systemInstruction = `The user's name is ${dataCustomization.customization.name}`;

    if (dataCustomization.customization.occupation) {
      systemInstruction += ` and they are a ${dataCustomization.customization.occupation}. Avoid mentioning their occupation but keep it in mind.`;
    }

    systemInstruction += "\n\n";
  }

  if (dataCustomization?.customization?.traits?.length) {
    systemInstruction =
      `You should have these traits: ${dataCustomization.customization.traits.join(", ")}.\n\n` +
      systemInstruction;
  }

  systemInstruction += `## System Instruction:\n\n${dataCustomization?.customization?.systemInstruction ?? "You are a helpful assistant."}`;

  const {
    messages,
    transformedMessages,
    assistantMessageId,
    threadId,
    model,
    providerOptions,
    config,
  } = data;

  console.dir(data, { depth: null });

  const streamId = generateId();
  const startTime = Date.now();

  posthog.capture({
    distinctId,
    event: "chat_request",
    properties: { userId: user.userId, model, streamId },
  });

  const result = streamText({
    model: registry.languageModel(model),
    system: systemInstruction,
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

      posthog.capture({
        distinctId,
        event: "chat_error",
        properties: { error: err.message, model, streamId, userId: user.userId },
      });
    },
  });

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

  waitUntil(updateTitle(messages, threadId));
  waitUntil(result.consumeStream());

  const chatStream = createUIMessageStream({
    execute: async ({ writer }) => {
      let content = "";
      let reasoning = "";

      writer.merge(
        result.toUIMessageStream({
          sendFinish: true,
          sendReasoning: true,
          sendSources: true,
          sendStart: true,
        }),
      );

      for await (const stream of result.fullStream) {
        switch (stream.type) {
          case "reasoning":
            reasoning += stream.text;
            break;

          case "text":
            content += stream.text;
            break;

          case "finish-step":
            metadata.model = stream.response.modelId;
            metadata.duration = Date.now() - startTime;
            metadata.finishReason = stream.finishReason;
            break;

          case "finish":
            metadata.totalTokens = stream.totalUsage.outputTokens ?? 0;
            metadata.thinkingTokens = stream.totalUsage.reasoningTokens ?? 0;
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
        const promise = serverConvexClient.mutation(api.messages.updateMessageById, {
          messageId: assistantMessageId,
          threadId,
          updates,
        });

        waitUntil(promise);
      }
    },
  });

  const reader = chatStream.getReader();

  const readableStream = new ReadableStream<string>({
    async start(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done || req.signal.aborted) break;
        controller.enqueue("data: " + JSON.stringify(value) + "\n\n");
      }

      if (!req.signal.aborted) {
        controller.enqueue("data: [DONE]\n\n");
      }

      return controller.close();
    },
  });

  const resumeableStream = await streamContext.createNewResumableStream(
    streamId,
    () => readableStream,
  );

  req.signal.onabort = async () => {
    console.log("[Chat] Chat request aborted");
    posthog.capture({
      distinctId,
      event: "chat_aborted",
      properties: { model, streamId, userId: user.userId },
    });
    await chatStream.cancel(new Error("Request aborted"));
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
