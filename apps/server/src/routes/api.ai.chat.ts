import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { matchError } from "better-result";
import { Hono } from "hono";

import { authenticate } from "@/middlewares/workos-authenticate";

import { buildChatAgent } from "@/libs/ai/agents";
import { buildSystemPrompts } from "@/libs/ai/agents/build-system-prompt";
import { getStreamResponseHeaders } from "@/libs/ai/headers";
import { consumeUserPoints, refundUserPoints } from "@/libs/ai/limits";
import type { ChatMetadata } from "@/libs/ai/types";
import { validateRequestBody } from "@/libs/ai/validation";
import { getValidationErrorResponse } from "@/libs/ai/validation/request";

import { logger } from "@/libs/axiom";
import { createServerConvexClient } from "@/libs/convex";
import { redisStreamClient } from "@/libs/redis/stream-client";

export const chatRouter = new Hono().basePath("/api/ai");
chatRouter.use("*", authenticate);

chatRouter.get("/chat/abort", async function (ctx) {
  const { streamId } = ctx.req.query();
  const auth = ctx.get("auth");

  if (!streamId) {
    logger.error("[Chat Error]: Missing ststreamTextreamId!", { streamId });
    return Response.json({ error: { message: "Error: Missing streamId!" } }, { status: 400 });
  }

  const streamResult = await redisStreamClient.cancelStreamForUser({
    requestId: streamId,
    userId: auth.userId,
  });

  if (streamResult.isErr()) {
    if (streamResult.error._tag === "StreamNotFoundError") {
      logger.error("[Chat Error]: Stream not found!", { userId: auth.userId, streamId });
      return Response.json({ error: { message: "Error: Stream not found!" } }, { status: 404 });
    }

    logger.error("[Chat Error]: Failed to resume chat streaming!", {
      streamId,
      userId: auth.userId,
      error: streamResult.error.message,
    });

    return Response.json(
      { error: { message: "Error: Failed to resume stream!" } },
      { status: 500 },
    );
  }

  logger.info("[Chat] Cancelled the stream!", { userId: auth.userId, streamId });
  return Response.json({ success: streamResult.value });
});

chatRouter.get("/chat", async function (ctx) {
  const { streamId } = ctx.req.query();
  const auth = ctx.get("auth");

  if (!streamId) {
    logger.error("[Chat Error]: Missing streamId!", { streamId });
    return Response.json({ error: { message: "Error: Missing streamId!" } }, { status: 400 });
  }

  const streamResult = await redisStreamClient.resumeStreamForUser({
    requestId: streamId,
    userId: auth.userId,
  });

  if (streamResult.isErr()) {
    if (streamResult.error._tag === "StreamNotFoundError") {
      logger.error("[Chat Error]: Stream not found!", { userId: auth.userId, streamId });
      return Response.json({ error: { message: "Error: Stream not found!" } }, { status: 404 });
    }

    logger.error("[Chat Error]: Failed to resume chat streaming!", {
      streamId,
      userId: auth.userId,
      error: streamResult.error.message,
    });

    return Response.json(
      { error: { message: "Error: Failed to resume stream!" } },
      { status: 500 },
    );
  }

  logger.info("[Chat] Resuming chat streaming!", { userId: auth.userId, streamId });
  return new Response(streamResult.value, { headers: getStreamResponseHeaders(streamId) });
});

chatRouter.post("/chat", async function (ctx) {
  const auth = ctx.get("auth");
  const requestId = ctx.get("requestId");

  const requestBody = await ctx.req.json();
  const validateResult = await validateRequestBody(requestBody);

  if (validateResult.isErr()) {
    const errorResposne = getValidationErrorResponse(validateResult.error);

    logger.error("Received invalid chat request body", { err: validateResult.error });
    return Response.json(
      { error: { message: errorResposne.message } },
      { status: errorResposne.status },
    );
  }

  const validatedBody = validateResult.value;
  const convexClient = await createServerConvexClient(ctx);
  const userPointsResult = await consumeUserPoints({ convexClient });

  if (userPointsResult.isErr()) {
    const limitMessage: string = matchError(userPointsResult.error, {
      UserMessageLimitReachedError: function (limitError) {
        return limitError.message;
      },
    });

    await convexClient.mutation(api.functions.messages.updateErrorMessage, {
      messageId: validatedBody.assistantMessageId,
      error: limitMessage,
      metadata: {
        model: { request: validatedBody.model.uniqueId, response: null },
        modelParams: validatedBody.modelParams,
      },
    });

    logger.error("[Chat Error]: User max message limit reached!", {
      userId: auth.userId,
      used: userPointsResult.error.usage.used,
      base: userPointsResult.error.usage.base,
      resetType: userPointsResult.error.usage.resetType,
    });

    return Response.json({ error: { message: limitMessage } }, { status: 429 });
  }

  const metadata: ChatMetadata = {
    model: { request: validatedBody.model.uniqueId, response: null },
    finishReason: null,
    timeToFirstTokenMs: 0,
    usages: { inputTokens: 0, outputTokens: 0, reasoningTokens: 0 },
    durations: { request: 0, reasoning: 0, text: 0 },

    modelParams: validatedBody.modelParams,
  };

  const systemInstruction = await buildSystemPrompts(ctx, metadata);

  const agent = buildChatAgent({
    systemInstruction,
    tools: validatedBody.tools,
    modelId: validatedBody.model.id,
    providerOptions: validatedBody.providerOptions,
  });

  const streamHandleResult = await redisStreamClient.createStreamForUser({
    requestId,
    userId: auth.userId,
  });

  if (streamHandleResult.isErr()) {
    logger.error("[Chat Error]: Failed to create resumable stream handle!", {
      userId: auth.userId,
      requestId,
      error: streamHandleResult.error.message,
    });

    return Response.json(
      { error: { message: "Error: Failed to initialize stream!" } },
      { status: 500 },
    );
  }

  const streamHandle = streamHandleResult.value;

  const startTime = Date.now();
  const stream = await agent.stream({
    abortSignal: streamHandle.abortSignal,
    messages: validatedBody.modelMessages,
  });

  let textStartTime = 0;
  let reasoningStartTime = 0;

  return stream.toUIMessageStreamResponse({
    generateMessageId: () => requestId,
    originalMessages: validatedBody.messages,

    sendFinish: true,
    sendSources: true,
    sendReasoning: true,

    status: 200,
    headers: getStreamResponseHeaders(requestId),

    consumeSseStream: async function ({ stream }) {
      logger.info("[Chat] Creating resumable stream", {
        userId: auth.userId,
        requestId: requestId,
      });

      await Promise.allSettled([
        streamHandle.startStream(stream),
        convexClient.mutation(api.functions.messages.updateMessageById, {
          messageId: validatedBody.assistantMessageId,
          updates: { status: "streaming", resumableStreamId: requestId, metadata },
        }),
      ]);
    },

    messageMetadata: ({ part }) => {
      switch (part.type) {
        case "reasoning-start":
          if (metadata.timeToFirstTokenMs === 0) {
            metadata.timeToFirstTokenMs = Date.now() - startTime;
            reasoningStartTime = Date.now();
          }
          break;

        case "reasoning-end":
          if (metadata.durations.reasoning === 0) {
            metadata.durations.reasoning = Date.now() - reasoningStartTime;
          }
          break;

        case "text-start":
          textStartTime = Date.now();
          if (metadata.timeToFirstTokenMs === 0) {
            metadata.timeToFirstTokenMs = Date.now() - startTime;
          }
          break;

        case "text-end":
          metadata.durations.text = Date.now() - textStartTime;
          break;

        case "finish-step":
          metadata.model.response = part.response.modelId;
          metadata.finishReason = part.finishReason;
          metadata.durations.request = Date.now() - startTime;

          metadata.usages.inputTokens = part.usage.inputTokens ?? metadata.usages.inputTokens;
          metadata.usages.outputTokens =
            part.usage.outputTokens ??
            part.usage.outputTokenDetails?.textTokens ??
            metadata.usages.outputTokens;

          metadata.usages.reasoningTokens =
            part.usage.reasoningTokens ??
            part.usage.outputTokenDetails?.reasoningTokens ??
            metadata.usages.reasoningTokens;
          break;

        case "finish":
          metadata.usages.inputTokens = part.totalUsage.inputTokens ?? 0;
          metadata.usages.outputTokens = part.totalUsage.outputTokenDetails.textTokens ?? 0;
          metadata.usages.reasoningTokens = part.totalUsage.outputTokenDetails.reasoningTokens ?? 0;

          return metadata;
      }

      return;
    },

    onFinish: async function ({ responseMessage }) {
      await redisStreamClient.cancelStreamForUser({ requestId, userId: auth.userId });

      await convexClient.mutation(api.functions.messages.updateFinishedMessageById, {
        messageId: validatedBody.assistantMessageId as Id<"messages">,
        updates: { metadata, parts: responseMessage.parts },
      });
    },
  });
});
