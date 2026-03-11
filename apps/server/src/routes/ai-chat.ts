import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";
import { RequestValidationError } from "@ai-chat/shared/chat/errors";
import { metadataSchema } from "@ai-chat/shared/chat/metadata";
import { tryCatch, tryCatchSync } from "@ai-chat/shared/utils/async";

import type { Hono } from "hono";
import { z } from "zod/v4";

import { APICallError, UI_MESSAGE_STREAM_HEADERS } from "ai";

import {
  messageIdSchema as messageIdSchemaZ,
  profileIdSchema,
  threadIdSchema as threadIdSchemaZ,
  validateRequestBody,
} from "../lib/validate-request-body";
import type { ChatMessage } from "../types";

import { handleFileCaching } from "../handle-file-caching";
import { getAuthContextFromCookieHeader } from "../auth";
import { buildSystemInstruction } from "../lib/prompt-builder";
import { buildAttachmentUrl } from "../lib/assets-urls";
import { buildChatAgent } from "../lib/chat-agent";
import { createServerConvexClient } from "../lib/convex-client";
import { serverUploadFileR2 } from "../lib/file-upload";
import { logger } from "../lib/logger";
import { updateTitle } from "../lib/update-title";
import { streamContext } from "../resumable-stream";
import { abortStream, registerStream, removeStream } from "../stream-registry";

const abortMetadataSchema = metadataSchema.unwrap().extend({
  modelParams: metadataSchema.unwrap().shape.modelParams.extend({
    profile: profileIdSchema.nullable().optional(),
  }),
});

const abortRequestBodySchema = z.object({
  streamId: z.string().min(1),
  threadId: threadIdSchemaZ,
  assistantMessageId: messageIdSchemaZ,
  parts: z.unknown(),
  metadata: abortMetadataSchema.optional(),
});

type AbortRequestBody = z.infer<typeof abortRequestBodySchema>;

type ChatModelParams = NonNullable<ChatMessage["metadata"]>["modelParams"];
type ChatMetadata = NonNullable<ChatMessage["metadata"]>;

const GENERIC_CHAT_ERROR_MESSAGE =
  "An error has occurred while processing your request. Please try again.";
const PROVIDER_CHAT_ERROR_MESSAGE =
  "The AI provider returned an error. Please try again in a moment.";

function normalizeError(error: unknown): Error {
  if (error instanceof Error) return error;
  return new Error(String(error));
}

function parseJsonString(value: string): unknown {
  const [parsed, parseError] = tryCatchSync(() => JSON.parse(value));
  if (parseError) return null;
  return parsed;
}

function getProviderLogData(error: APICallError): Record<string, unknown> {
  const responseBody = error.responseBody;
  if (!responseBody || responseBody.length === 0) {
    return {
      providerStatusCode: error.statusCode ?? null,
      providerResponseBody: null,
    };
  }

  return {
    providerStatusCode: error.statusCode ?? null,
    providerResponseBody: parseJsonString(responseBody) ?? responseBody,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function finalizeStreamParts(parts: unknown): unknown {
  if (!Array.isArray(parts)) return parts;

  const out: Array<unknown> = [];
  for (const part of parts) {
    if (!isRecord(part)) {
      out.push(part);
      continue;
    }

    const next: Record<string, unknown> = { ...part };
    const type = next["type"];

    if ((type === "text" || type === "reasoning") && next["state"] === "streaming") {
      next["state"] = "done";
    }

    if (type === "reasoning") {
      delete next["providerMetadata"];

      const text = next["text"];
      if (typeof text !== "string" || text.trim().length === 0) {
        continue;
      }
    }

    out.push(next);
  }

  return out;
}

function getStreamResponseHeaders(streamId: string): Record<string, string> {
  return {
    ...UI_MESSAGE_STREAM_HEADERS,
    "Transfer-Encoding": "chunked",
    "Content-Type": "text/event-stream; charset=utf-8",
    "X-Stream-Id": streamId,
  };
}

export function registerAiChatRoutes(app: Hono): void {
  // Resume stream route
  app.get("/api/ai/chat", async (ctx) => {
    const { streamId } = ctx.req.query();
    const requestId = ctx.get("requestId");

    if (!streamId) {
      logger.error("[Chat Error]: Missing streamId!", { streamId });
      return Response.json({ error: { message: "Error: Missing streamId!" } }, { status: 400 });
    }

    const cookieHeader = ctx.req.header("Cookie");
    let auth: { userId: string; sessionId: string } | null = null;

    try {
      auth = await getAuthContextFromCookieHeader({ cookieHeader });
    } catch (error) {
      const err = normalizeError(error);

      logger.warn("[Chat] Resume request rejected (unauthenticated)", {
        requestId,
        streamId,
        message: err.message,
      });

      return Response.json({ error: { message: "Error: Unauthenticated!" } }, { status: 401 });
    }

    const convexClient = createServerConvexClient();

    const canResume = await convexClient.query(api.functions.messages.canResumeStream, {
      sessionId: auth.sessionId,
      streamId,
    });

    if (!canResume) {
      logger.info("[Chat] Resume blocked (not resumable)", {
        userId: auth.userId,
        streamId,
      });

      return Response.json(
        { error: { message: "Error: Stream is no longer resumable." } },
        { status: 404 },
      );
    }

    logger.info("[Chat] Resuming chat streaming!", { userId: auth.userId, streamId });

    const stream = await streamContext.resumeExistingStream(streamId);

    if (!stream) {
      logger.error("[Chat Error]: Stream not found!", { userId: auth.userId, streamId });
      return Response.json({ error: { message: "Error: Stream not found!" } }, { status: 404 });
    }

    return new Response(stream, {
      headers: getStreamResponseHeaders(streamId),
    });
  });

  // Abort stream route (server-side cancellation)
  app.post("/api/ai/chat/abort", async (ctx) => {
    const requestId = ctx.get("requestId");
    const cookieHeader = ctx.req.header("Cookie");
    let auth: { userId: string; sessionId: string } | null = null;

    try {
      auth = await getAuthContextFromCookieHeader({ cookieHeader });
    } catch (error) {
      const err = normalizeError(error);

      logger.warn("[Chat] Abort request rejected (unauthenticated)", {
        requestId,
        message: err.message,
      });

      return Response.json({ error: { message: "Error: Unauthenticated!" } }, { status: 401 });
    }

    const [rawBody, rawBodyError] = await tryCatch(ctx.req.json());
    if (rawBodyError) {
      return Response.json({ error: { message: "Error: Invalid JSON body." } }, { status: 400 });
    }

    const parsed = abortRequestBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return Response.json({ error: { message: z.prettifyError(parsed.error) } }, { status: 400 });
    }

    const body: AbortRequestBody = parsed.data;

    const aborted = abortStream(body.streamId);
    removeStream(body.streamId);

    const convexClient = createServerConvexClient();

    type Updates = (typeof api.functions.messages.updateMessageById)["_args"]["updates"];

    const updates: Updates = {
      parts: finalizeStreamParts(body.parts),
      status: "complete",
      resumableStreamId: null,
    };

    if (body.metadata) {
      updates.metadata = { ...body.metadata, finishReason: "aborted" };
    }

    await convexClient.mutation(api.functions.messages.updateMessageById, {
      sessionId: auth.sessionId,
      messageId: body.assistantMessageId,
      updates,
    });

    logger.info("[Chat] Abort requested", {
      userId: auth.userId,
      threadId: body.threadId,
      assistantMessageId: body.assistantMessageId,
      streamId: body.streamId,
      aborted,
    });

    return Response.json({ ok: true, aborted });
  });

  // Main chat streaming route
  app.post("/api/ai/chat", async (ctx) => {
    const req = ctx.req;

    const requestId = ctx.get("requestId");
    const cookieHeader = req.header("Cookie");

    let auth: { userId: string; sessionId: string } | null = null;

    try {
      auth = await getAuthContextFromCookieHeader({ cookieHeader });
    } catch {
      logger.error("[Chat Error]: Unauthenticated POST request!");
      return Response.json({ error: { message: "Error: Unauthenticated!" } }, { status: 401 });
    }

    const { userId, sessionId } = auth;

    logger.info("[Chat] Chat request received", { userId, requestId });

    const convexClient = createServerConvexClient();
    let assistantMessageIdForError: Id<"messages"> | null = null;
    let threadIdForError: Id<"threads"> | null = null;
    let modelUniqueIdForError: string | null = null;
    let modelParamsForError: ChatModelParams | null = null;

    let usageReserved = false;
    let usageRefunded = false;
    let errorMessagePersisted = false;

    try {
      const body = await req.json();

      const [requestBody, validateError] = await tryCatch(validateRequestBody(body));
      if (validateError) {
        if (validateError instanceof RequestValidationError) {
          logger.info("[Chat] Blocked deprecated model request", {
            userId,
            requestId,
            ...validateError.details,
          });

          return Response.json(
            {
              error: {
                code: validateError.code,
                message: validateError.message,
                details: validateError.details,
              },
            },
            { status: 409 },
          );
        }

        logger.error("[Chat Error]: Failed to parse request body!", {
          error: validateError,
          userId,
        });
        return Response.json({ error: { message: validateError.message } }, { status: 400 });
      }

      const {
        messages,
        modelMessages,
        assistantMessageId,
        threadId,
        streamId,
        model,
        providerOptions,
        modelParams,
        tools,
      } = requestBody;

      assistantMessageIdForError = assistantMessageId;
      threadIdForError = threadId;
      modelUniqueIdForError = model.uniqueId;
      modelParamsForError = modelParams;

      // Enforce per-user usage limit before processing the request
      const usage = await convexClient.mutation(api.functions.usages.checkAndIncrement, {
        amount: 1,
        sessionId,
      });

      if (!usage.allowed) {
        const type = usage.resetType === "daily" ? "Daily" : "Monthly";

        await convexClient.mutation(api.functions.messages.updateErrorMessage, {
          sessionId,
          messageId: assistantMessageId,
          error: `${type} message limit reached (${usage.used}/${usage.base}).`,
          metadata: { model: { request: model.uniqueId, response: null }, modelParams },
        });

        logger.error("[Chat Error]: User max message limit reached!", {
          userId,
          used: usage.used,
          base: usage.base,
          resetType: usage.resetType,
        });

        return Response.json(
          { error: { message: `${type} message limit reached (${usage.used}/${usage.base}).` } },
          { status: 429 },
        );
      }

      usageReserved = true;

      const userPreferencesPromise = convexClient.query(
        api.functions.users.getCurrentUserPreferences,
        { sessionId },
      );

      const profilePromise = modelParams.profile
        ? convexClient.query(api.functions.profiles.getProfile, {
            sessionId,
            profileId: modelParams.profile,
          })
        : null;

      const [userPreferences, profile] = await Promise.all([
        userPreferencesPromise,
        profilePromise,
      ]);

      const systemInstruction = await buildSystemInstruction(userPreferences, profile, {
        webSearchEnabled: Boolean(tools.web_search),
      });

      const metadata: ChatMetadata = {
        model: { request: model.uniqueId, response: null },
        finishReason: null,
        timeToFirstTokenMs: 0,
        usages: { inputTokens: 0, outputTokens: 0, reasoningTokens: 0 },
        durations: { request: 0, reasoning: 0, text: 0 },

        modelParams,
      };

      const startTime = Date.now();
      const activeStreamId = streamId ?? requestId;
      const serverAbortController = registerStream(activeStreamId);
      let streamErrorDetected = false;
      let streamErrorHandlingStarted = false;

      function getStreamResponseErrorMessage(error: unknown): string {
        const err = normalizeError(error);

        if (APICallError.isInstance(err)) {
          return PROVIDER_CHAT_ERROR_MESSAGE;
        }

        return GENERIC_CHAT_ERROR_MESSAGE;
      }

      async function persistStreamError(error: unknown): Promise<void> {
        if (streamErrorHandlingStarted) return;
        streamErrorHandlingStarted = true;

        const err = normalizeError(error);
        const errorMessage = getStreamResponseErrorMessage(error);

        if (err.name === "AbortError" && serverAbortController.signal.aborted) return;

        if (APICallError.isInstance(err)) {
          logger.error("[Chat Error] Provider request failed", {
            userId,
            threadId,
            assistantMessageId,
            model: model.uniqueId,
            requestId,
            message: err.message,
            name: err.name,
            stack: err.stack,
            ...getProviderLogData(err),
          });
        } else {
          logger.error("[Chat Error] Stream request failed", {
            userId,
            threadId,
            assistantMessageId,
            model: model.uniqueId,
            requestId,
            message: err.message,
            name: err.name,
            stack: err.stack,
          });
        }

        if (usageReserved && !usageRefunded) {
          const [, refundError] = await tryCatch(
            convexClient.mutation(api.functions.usages.refundRequest, { amount: 1, sessionId }),
          );

          if (refundError) {
            logger.error("[Chat Error] Failed to refund usage", {
              userId,
              threadId,
              assistantMessageId,
              requestId,
              message: refundError.message,
              stack: refundError.stack,
            });
          } else {
            usageRefunded = true;
          }
        }

        const [, persistError] = await tryCatch(
          convexClient.mutation(api.functions.messages.updateErrorMessage, {
            sessionId,
            error: errorMessage,
            messageId: assistantMessageId,
            metadata: { model: { request: model.uniqueId, response: null }, modelParams },
          }),
        );

        if (persistError) {
          logger.error("[Chat Error] Failed to persist assistant error message", {
            userId,
            threadId,
            assistantMessageId,
            requestId,
            message: persistError.message,
            stack: persistError.stack,
          });
          return;
        }

        errorMessagePersisted = true;
      }

      const agent = buildChatAgent({
        modelId: model.id,
        systemInstruction,
        providerOptions,
        tools,
        experimentalDownload: (options) => Promise.all(options.map(handleFileCaching)),
      });

      const result = await agent.stream({
        prompt: modelMessages,

        // IMPORTANT: Do not use req.signal here (browser/tab close should NOT cancel the server stream).
        abortSignal: serverAbortController.signal,

        async onStepFinish({ finishReason, response, usage }) {
          if (streamErrorDetected) return;

          if (metadata.timeToFirstTokenMs === 0) {
            metadata.timeToFirstTokenMs = Date.now() - startTime;
          }

          metadata.model.response = response.modelId;
          metadata.finishReason = finishReason;
          metadata.durations.request = Date.now() - startTime;

          metadata.usages.inputTokens = usage.inputTokens ?? metadata.usages.inputTokens;
          metadata.usages.outputTokens =
            usage.outputTokens ??
            usage.outputTokenDetails?.textTokens ??
            metadata.usages.outputTokens;
          metadata.usages.reasoningTokens =
            usage.reasoningTokens ??
            usage.outputTokenDetails?.reasoningTokens ??
            metadata.usages.reasoningTokens;
        },

        async onFinish({ totalUsage, finishReason, response }) {
          if (streamErrorDetected) return;

          metadata.durations.request = Date.now() - startTime;
          metadata.finishReason = finishReason;
          metadata.model.response = response.modelId;

          metadata.usages.inputTokens = totalUsage.inputTokens ?? metadata.usages.inputTokens;
          metadata.usages.outputTokens =
            totalUsage.outputTokens ??
            totalUsage.outputTokenDetails?.textTokens ??
            metadata.usages.outputTokens;
          metadata.usages.reasoningTokens =
            totalUsage.reasoningTokens ??
            totalUsage.outputTokenDetails?.reasoningTokens ??
            metadata.usages.reasoningTokens;
        },
      });

      void updateTitle({
        messages: modelMessages,
        threadId,
        serverConvexClient: convexClient,
        sessionId,
      });

      let reasoningStartTime = 0;
      let textStartTime = 0;

      return result.toUIMessageStreamResponse({
        originalMessages: messages,
        generateMessageId: () => requestId,
        sendReasoning: true,
        status: 200,
        headers: getStreamResponseHeaders(activeStreamId),
        consumeSseStream: async ({ stream }) => {
          logger.info("[Chat] Creating resumable stream", {
            userId,
            requestId,
            streamId: activeStreamId,
            threadId,
          });

          await Promise.all([
            streamContext.createNewResumableStream(activeStreamId, () => stream),
            convexClient.mutation(api.functions.messages.updateMessageById, {
              sessionId,
              messageId: assistantMessageId,
              updates: { status: "streaming", resumableStreamId: activeStreamId, metadata },
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
              metadata.usages.reasoningTokens =
                part.totalUsage.outputTokenDetails.reasoningTokens ?? 0;

              return metadata;
          }

          return;
        },

        async onFinish({ responseMessage, isAborted }) {
          removeStream(activeStreamId);

          if (isAborted) {
            // Fallback: preferred path is POST /api/ai/chat/abort (persist partial output),
            // but keep this as a safety net.
            await convexClient.mutation(api.functions.messages.updateMessageById, {
              sessionId,
              messageId: assistantMessageId,
              updates: { resumableStreamId: null, status: "complete" },
            });

            logger.info("[Chat] Request finished as aborted", {
              userId,
              threadId,
              requestId,
              streamId: activeStreamId,
            });
            return;
          }

          if (streamErrorDetected) {
            await persistStreamError(new Error("Chat stream finished with provider error."));

            logger.info("[Chat] Stream finished after error", {
              userId,
              threadId,
              requestId,
              streamId: activeStreamId,
            });
            return;
          }

          const parts = responseMessage.parts as ChatMessage["parts"];
          const fileParts = parts.filter((part) => part.type === "file");
          const uploadFileParts = fileParts as Array<
            Extract<ChatMessage["parts"][number], { type: "file" }>
          >;

          const attachmentIds: Array<Id<"attachments">> = [];
          const generatedFiles = (await result.files).map(async (file, index) => {
            const data = await serverUploadFileR2({
              threadId,
              sessionId,
              buffer: file.uint8Array,
              mediaType: file.mediaType,
              serverConvexClient: convexClient,
            });

            if (!data) return;

            const url = buildAttachmentUrl(data.filePathname, file.mediaType);

            attachmentIds.push(data.attachmentDocId);
            const currentPart = uploadFileParts[index];
            if (!currentPart) return;
            currentPart.url = url;
          });

          await Promise.all(generatedFiles);

          type Updates = (typeof api.functions.messages.updateMessageById)["_args"]["updates"];
          const updates: Updates = {
            parts: finalizeStreamParts(parts) as ChatMessage["parts"],
            metadata,
            resumableStreamId: null,
            status: "complete",

            attachments: attachmentIds,
          };

          logger.info("[Chat] Chat request completed!", {
            userId,
            threadId,
            assistantMessageId,
            model: model.uniqueId,
            profileId: modelParams.profile,
            metadata,
            requestId,
            streamId: activeStreamId,
          });

          await convexClient.mutation(api.functions.messages.updateMessageById, {
            sessionId,
            updates,
            messageId: assistantMessageId,
          });
        },

        onError(error) {
          streamErrorDetected = true;
          removeStream(activeStreamId);

          void persistStreamError(error);
          return getStreamResponseErrorMessage(error);
        },
      });
    } catch (error) {
      const err = normalizeError(error);

      logger.error("[Chat Fatal Error]: " + err.message, {
        userId,
        requestId,
        threadId: threadIdForError,
        assistantMessageId: assistantMessageIdForError,
        model: modelUniqueIdForError,
        stack: err.stack,
      });

      if (usageReserved && !usageRefunded) {
        const [, refundError] = await tryCatch(
          convexClient.mutation(api.functions.usages.refundRequest, { amount: 1, sessionId }),
        );

        if (refundError) {
          logger.error("[Chat Fatal Error] Failed to refund usage", {
            userId,
            requestId,
            threadId: threadIdForError,
            assistantMessageId: assistantMessageIdForError,
            message: refundError.message,
            stack: refundError.stack,
          });
        } else {
          usageRefunded = true;
        }
      }

      if (
        !errorMessagePersisted &&
        assistantMessageIdForError &&
        modelUniqueIdForError &&
        modelParamsForError
      ) {
        const [, persistError] = await tryCatch(
          convexClient.mutation(api.functions.messages.updateErrorMessage, {
            sessionId,
            messageId: assistantMessageIdForError,
            error: GENERIC_CHAT_ERROR_MESSAGE,
            metadata: {
              model: { request: modelUniqueIdForError, response: null },
              modelParams: modelParamsForError,
            },
          }),
        );

        if (persistError) {
          logger.error("[Chat Fatal Error] Failed to persist assistant error", {
            userId,
            requestId,
            threadId: threadIdForError,
            assistantMessageId: assistantMessageIdForError,
            message: persistError.message,
            stack: persistError.stack,
          });
        }
      }

      return Response.json({ error: { message: GENERIC_CHAT_ERROR_MESSAGE } }, { status: 500 });
    }
  });
}
