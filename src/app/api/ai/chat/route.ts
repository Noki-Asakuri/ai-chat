import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { serverConvexClient } from "@/lib/convex/server";

import { auth } from "@clerk/nextjs/server";
import { waitUntil } from "@vercel/functions";
import { checkBotId } from "botid/server";
import dedent from "dedent";
import { Redis } from "ioredis";
import { after, NextResponse, type NextRequest } from "next/server";
import { createResumableStreamContext } from "resumable-stream/ioredis";

import { createUIMessageStream, generateId, smoothStream, streamText, type AISDKError } from "ai";

import { logger, withAxiom } from "@/lib/axiom/server";
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

export const POST = withAxiom(async (req) => {
  const verification = await checkBotId();

  if (verification.isBot) {
    logger.error("[Chat Error]: Access denied!", { verification });
    return NextResponse.json({ error: { message: "Error: Access denied!" } }, { status: 401 });
  }

  const user = await auth();
  if (!user.userId) {
    logger.error("[Chat Error]: Unauthenticated POST request!", { user });
    return NextResponse.json({ error: { message: "Error: Unauthenticated!" } }, { status: 401 });
  }

  const authToken = await user.getToken({ template: "convex" });
  if (!authToken) {
    logger.error("[Chat Error]: Missing Convex auth token!", { user });
    return NextResponse.json(
      { error: { message: "Error: Missing Convex auth token!" } },
      { status: 401 },
    );
  }
  serverConvexClient.setAuth(authToken);

  const [data, error] = await tryCatch(() => getRequestBody(req, user.userId));
  if (error) {
    logger.error("[Chat Error]: Failed to parse request body!", { error, userId: user.userId });
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

  // Enforce monthly per-user usage limit before processing the request
  const usage = await serverConvexClient.mutation(api.functions.usages.checkAndIncrement, {
    amount: 1,
  });

  if (!usage.allowed) {
    await serverConvexClient.mutation(api.functions.messages.updateErrorMessage, {
      error: `Monthly message limit reached (${usage.used}/${usage.base}).`,
      model: model.uniqueId,
      messageId: assistantMessageId,
    });

    logger.error("[Chat Error]: Monthly message limit reached!", {
      userId: user.userId,
      used: usage.used,
      base: usage.base,
    });

    return NextResponse.json(
      { error: { message: `Monthly message limit reached (${usage.used}/${usage.base}).` } },
      { status: 429 },
    );
  }

  const dataCustomization = await serverConvexClient.query(api.functions.users.currentUser);
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
      logger.error("[Chat Error]: " + err.message, {
        userId: user.userId,
        threadId,
        assistantMessageId,
        model: model.uniqueId,
        errorName: err.name,
      });

      // Skip proxy-related type validation errors as they are expected during proxy configuration
      if (err.name === "AI_TypeValidationError" && err.message.includes("proxy-")) return;
      if (err.name === "AbortError" && req.signal.aborted) return;

      await serverConvexClient.mutation(api.functions.usages.refundRequest, { amount: 1 });
      await serverConvexClient.mutation(api.functions.messages.updateErrorMessage, {
        error: err.message,
        model: model.uniqueId,
        messageId: assistantMessageId,
      });
    },
  });

  await serverConvexClient.mutation(api.functions.messages.updateMessageById, {
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

      // OpenAI reasoning return multiple reasoning-start/end events. We only want to count the first one.
      let hasStartedReasoning = false;

      for await (const stream of result.fullStream) {
        switch (stream.type) {
          case "reasoning-start":
            if (hasStartedReasoning) {
              // OpenAI seperate reasoning part with new 'reasoning-start' event
              reasoning += "\n\n";
              continue;
            }

            // Start first token time if model return reasoning
            metadata.timeToFirstTokenMs = Date.now() - startTime;
            reasoningDuration = Date.now();

            hasStartedReasoning = true;
            break;

          case "reasoning-delta":
            reasoning += stream.text;
            break;

          case "reasoning-end":
            if (metadata.durations.reasoning === 0) {
              metadata.durations.reasoning = Date.now() - reasoningDuration;
            }
            break;

          case "text-start":
            textDuration = Date.now();
            if (metadata.timeToFirstTokenMs === 0) {
              metadata.timeToFirstTokenMs = Date.now() - startTime;
            }
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

            if (
              model.id.startsWith("openai/gpt-5") &&
              metadata.totalTokens > metadata.thinkingTokens
            ) {
              // OpenAI GPT 5 output token also includes the reasoning tokens
              metadata.totalTokens = metadata.totalTokens - metadata.thinkingTokens;
            }
            break;
        }
      }

      type Updates = (typeof api.functions.messages.updateMessageById)["_args"]["updates"];

      const updates: Updates = {
        metadata,
        model: model.uniqueId,
        resumableStreamId: null,
        status: "complete" as const,

        content: fixMarkdownCodeBlocks(content),
        reasoning: reasoning.length > 0 ? reasoning : undefined,
      };

      logger.info("[Chat] Chat request completed!", {
        userId: user.userId,
        threadId,
        assistantMessageId,
        model: model.uniqueId,
        metadata,
      });

      if (updates.content?.length === 0) {
        updates.content = `Upstream returned empty content. Please try again. Reason: ${metadata.finishReason}`;
        logger.error("[Chat Error]: Upstream returned empty content!", {
          userId: user.userId,
          threadId,
          assistantMessageId,
          model: model.uniqueId,
          metadata,
        });
      }

      if (!req.signal.aborted) {
        const promise = serverConvexClient.mutation(api.functions.messages.updateMessageById, {
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
    logger.error("[Chat Error]: Chat request aborted!", {
      userId: user.userId,
      threadId,
      assistantMessageId,
      model: model.uniqueId,
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
