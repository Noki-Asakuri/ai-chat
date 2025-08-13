import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { serverConvexClient } from "@/lib/convex/server";

import { auth } from "@clerk/nextjs/server";
import { waitUntil } from "@vercel/functions";
import { Redis } from "ioredis";
import dedent from "dedent";
import { after, NextResponse, type NextRequest } from "next/server";
import { createResumableStreamContext } from "resumable-stream/ioredis";

import { createUIMessageStream, generateId, smoothStream, streamText, type AISDKError } from "ai";

import { getRequestBody } from "@/lib/server/get-request-body";
import { registry } from "@/lib/server/model-registry";
import { updateTitle } from "@/lib/server/update-title";
import { fixMarkdownCodeBlocks, tryCatch } from "@/lib/utils";

import { env } from "@/env";

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
    tools,
  } = data;

  const dataCustomization = await serverConvexClient.query(api.users.currentUser);
  let systemInstruction = "";

  if (dataCustomization?.customization?.name) {
    systemInstruction += dedent`
		<user>
		## User Information:
		User basic information. Avoid mentioning the user's name or occupation during the conversation.
		Keep it in mind and use it when necessary.

		Name: ${dataCustomization.customization.name ?? "user"}
		Occupation: ${dataCustomization.customization.occupation ?? "unknown"}
		</user>
		\n`;
  }

  systemInstruction += dedent`
	<global>
	## Global System Instruction:
	This is the global system instruction. It should be followed unless there is a conflicting instruction in the AI Profile Instruction.

	${dataCustomization?.customization?.systemInstruction ?? "You are a helpful assistant."}
	</global>
	`;

  const profilePrompt = config.profile?.systemPrompt?.trim();
  if (profilePrompt && profilePrompt.length > 0) {
    systemInstruction += dedent`\n
		<profile>
		## AI Profile Instruction:
		User defined instruction. This is the most important instruction. It should take precedence over the global system instruction.

		${profilePrompt}

		<traits>
		## Traits (Optional):
		You should have these traits: ${dataCustomization?.customization?.traits?.join(", ") ?? "None"}.
		</traits>
		</profile>
		`;
  }

  const streamId = generateId();
  const startTime = Date.now();

  const result = streamText({
    model: registry.languageModel(model.id),
    system: systemInstruction.trim(),
    messages: transformedMessages,
    providerOptions,
    tools,
    abortSignal: req.signal,

    topP: config.topP,
    topK: config.topK,
    temperature: config.temperature,
    maxOutputTokens: config.maxTokens,
    presencePenalty: config.presencePenalty,
    frequencyPenalty: config.frequencyPenalty,

    experimental_transform: smoothStream({ delayInMs: 10, chunking: "line" }),

    async onError({ error }) {
      const err = error as AISDKError;
      console.error("[Chat] Error:", err);

      // Skip proxy-related type validation errors as they are expected during proxy configuration
      if (err.name === "AI_TypeValidationError" && err.message.includes("proxy-")) return;
      if (err.name === "AbortError" && req.signal.aborted) return;

      await serverConvexClient.mutation(api.messages.updateErrorMessage, {
        error: err.message,
        model: model.uniqueId,
        messageId: assistantMessageId,
      });
    },
  });

  await serverConvexClient.mutation(api.messages.updateMessageById, {
    threadId,
    messageId: assistantMessageId,
    updates: { status: "streaming", resumableStreamId: streamId, model: model.uniqueId },
  });

  const metadata = {
    model: model.uniqueId as string,
    aiProfileId: config.profile?.id ?? undefined,
    duration: 0,
    finishReason: "",
    totalTokens: 0,
    thinkingTokens: 0,
    timeToFirstTokenMs: 0,
    durations: { request: 0, reasoning: 0, text: 0 },
  } satisfies Doc<"messages">["metadata"];

  waitUntil(updateTitle(messages, threadId));
  waitUntil(result.consumeStream());

  const chatStream = createUIMessageStream({
    execute: async ({ writer }) => {
      let content = "";
      let reasoning = "";
      let reasoningDuration = 0;
      let textDuration = 0;

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
          case "reasoning-start":
            reasoningDuration = Date.now();
            break;

          case "reasoning-delta":
            reasoning += stream.text;
            break;

          case "reasoning-end":
            metadata.durations.reasoning = Date.now() - reasoningDuration;
            break;

          case "text-start":
            textDuration = Date.now();
            metadata.timeToFirstTokenMs = Date.now() - startTime;
            break;

          case "text-delta":
            content += stream.text;
            break;

          case "text-end":
            metadata.durations.text = Date.now() - textDuration;
            break;

          case "finish-step":
            metadata.model = stream.response.modelId;
            metadata.finishReason = stream.finishReason;

            metadata.duration = Date.now() - startTime;
            metadata.durations.request = metadata.duration;
            break;

          case "finish":
            metadata.totalTokens = stream.totalUsage.outputTokens ?? 0;
            metadata.thinkingTokens = stream.totalUsage.reasoningTokens ?? 0;
            break;
        }
      }

      type Updates = (typeof api.messages.updateMessageById)["_args"]["updates"];

      const updates: Updates = {
        metadata,
        model: model.uniqueId,
        resumableStreamId: null,
        status: "complete" as const,

        content: fixMarkdownCodeBlocks(content),
        reasoning: reasoning.length > 0 ? reasoning : undefined,
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
