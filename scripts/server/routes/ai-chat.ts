import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import dedent from "dedent";
import type { Hono } from "hono";
import { z } from "zod/v4";

import { APICallError, stepCountIs, streamText, UI_MESSAGE_STREAM_HEADERS } from "ai";

import { logger } from "@/lib/axiom/logger";
import { createServerConvexClient } from "@/lib/convex/server";
import { serverUploadFileR2 } from "@/lib/server/file-upload";
import { registry } from "@/lib/server/model-registry";
import { updateTitle } from "@/lib/server/update-title";
import {
  messageIdSchema as messageIdSchemaZ,
  profileIdSchema,
  threadIdSchema as threadIdSchemaZ,
  validateRequestBody,
} from "@/lib/server/validate-request-body";
import type { ChatMessage } from "@/lib/types";
import { tryCatch } from "@/lib/utils";

import { handleFileCaching } from "../../handle-file-caching";
import { getAuthContextFromCookieHeader } from "../auth";
import { streamContext } from "../resumable-stream";
import { abortStream, registerStream, removeStream } from "../stream-registry";

const abortMetadataSchema = z.object({
  model: z.object({ request: z.string(), response: z.string().nullable() }),
  finishReason: z.string().nullable(),
  timeToFirstTokenMs: z.number(),
  durations: z.object({ request: z.number(), reasoning: z.number(), text: z.number() }),
  usages: z.object({
    inputTokens: z.number(),
    outputTokens: z.number(),
    reasoningTokens: z.number(),
  }),
  modelParams: z.object({
    webSearch: z.boolean(),
    effort: z.enum(["none", "minimal", "low", "medium", "high", "xhigh"]),
    // IMPORTANT: Convex expects an Id<"profiles"> here, which is a branded string type.
    // The client can't produce the branded type without unsafe casting, so we accept the string
    // and normalize it to null before persisting.
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

function finalizeStreamParts(parts: unknown): unknown {
  if (!Array.isArray(parts)) return parts;

  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }

  const out: Array<unknown> = [];
  for (const part of parts) {
    if (!isRecord(part)) {
      out.push(part);
      continue;
    }

    const next: Record<string, unknown> = { ...part };
    const type = next["type"];

    if (type === "step-start") continue;

    if ((type === "text" || type === "reasoning") && next["state"] === "streaming") {
      next["state"] = "done";
    }

    const isSourcePart =
      type === "source-url" ||
      type === "source-document" ||
      (typeof type === "string" && type.startsWith("source-"));

    if ("providerMetadata" in next && !isSourcePart) {
      delete next["providerMetadata"];
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
    if (!streamId) {
      logger.error("[Chat Error]: Missing streamId!", { streamId });
      return Response.json({ error: { message: "Error: Missing streamId!" } }, { status: 400 });
    }

    const cookieHeader = ctx.req.header("Cookie");
    let auth: { userId: string; sessionId: string } | null = null;

    try {
      auth = await getAuthContextFromCookieHeader({ cookieHeader });
    } catch {
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
    const cookieHeader = ctx.req.header("Cookie");
    let auth: { userId: string; sessionId: string } | null = null;

    try {
      auth = await getAuthContextFromCookieHeader({ cookieHeader });
    } catch {
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

    try {
      const body = await req.json();

      const [requestBody, validateError] = await tryCatch(validateRequestBody(body));
      if (validateError) {
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
        model,
        providerOptions,
        modelParams,
        tools,
      } = requestBody;

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

      let systemInstruction = "";
      const userCustomization = await convexClient.query(api.functions.users.currentUser, {
        sessionId,
      });

      if (userCustomization?.customization?.name) {
        systemInstruction += dedent`
				<user>
				## User Information:
				User basic information. Avoid mentioning the user's name or occupation during the conversation.
				Keep it in mind and use it when necessary.

				Name: ${userCustomization.customization.name ?? "user"}
				Occupation: ${userCustomization.customization.occupation ?? "unknown"}
				</user>
				\n`;
      }

      systemInstruction += dedent`
			<global>
			## Global System Instruction:
			This is the global system instruction. It should be followed unless there is a conflicting instruction in the AI Profile Instruction.

			${userCustomization?.customization?.systemInstruction ?? "You are a helpful assistant."}
			</global>
		`;

      if (modelParams.profile) {
        const profile = await convexClient.query(api.functions.profiles.getProfile, {
          sessionId,
          profileId: modelParams.profile,
        });

        const prompt = profile?.systemPrompt ?? "";

        if (prompt && prompt.length > 0) {
          systemInstruction += dedent`\n
					<profile>
					## AI Profile Instruction:
					User defined instruction. This is the most important instruction. It should take precedence over the global system instruction.

					${prompt}

					<traits>
					## Traits (Optional):
					You should have these traits: ${userCustomization?.customization?.traits?.join(", ") ?? "None"}.
					</traits>
					</profile>
					`;
        }
      }

      const startTime = Date.now();
      const serverAbortController = registerStream(requestId);

      const result = streamText({
        model: registry(model.id),
        system: systemInstruction.trim(),
        messages: modelMessages,
        providerOptions,
        tools,

        // IMPORTANT: Do not use req.signal here (browser/tab close should NOT cancel the server stream).
        abortSignal: serverAbortController.signal,

        onAbort: () => {
          removeStream(requestId);
          logger.info("[Chat] Stream aborted (server-side)", { userId, threadId, requestId });
        },

        experimental_telemetry: { isEnabled: false },

        maxRetries: 5,
        stopWhen: stepCountIs(20),

        experimental_download: (options) => Promise.all(options.map(handleFileCaching)),

        async onError({ error }) {
          const err = error as Error;
          let errorMessage = `An error have occurred. Please try again. \n\nError: ${err.message}`;

          // Ignore aborts triggered via our server-side abort controller
          if (err.name === "AbortError" && serverAbortController.signal.aborted) return;

          if (APICallError.isInstance(err)) {
            const responseBody = JSON.parse(err.responseBody || "{}");

            errorMessage = dedent.withOptions({ trimWhitespace: true, alignValues: true })`
						An error have occurred. This is likely a server-side error, Please report to the developer.

						Error:
						\`\`\`
						${JSON.stringify(responseBody, null, 2)}
						\`\`\`
						`;
          }

          logger.error("[Chat Error]: " + err.message, {
            userId,
            threadId,
            assistantMessageId,
            model: model.uniqueId,
          });

          await convexClient.mutation(api.functions.usages.refundRequest, { amount: 1, sessionId });
          await convexClient.mutation(api.functions.messages.updateErrorMessage, {
            sessionId,
            error: errorMessage,
            messageId: assistantMessageId,
            metadata: { model: { request: model.uniqueId, response: null }, modelParams },
          });
        },
      });

      const metadata: ChatMessage["metadata"] = {
        model: { request: model.uniqueId, response: null },
        finishReason: null,
        timeToFirstTokenMs: 0,
        usages: { inputTokens: 0, outputTokens: 0, reasoningTokens: 0 },
        durations: { request: 0, reasoning: 0, text: 0 },

        modelParams,
      };

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
        headers: getStreamResponseHeaders(requestId),
        consumeSseStream: async ({ stream }) => {
          logger.info("[Chat] Creating resumable stream", { userId, requestId, threadId });

          await Promise.all([
            streamContext.createNewResumableStream(requestId, () => stream),
            convexClient.mutation(api.functions.messages.updateMessageById, {
              sessionId,
              messageId: assistantMessageId,
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
          removeStream(requestId);

          if (isAborted) {
            // Fallback: preferred path is POST /api/ai/chat/abort (persist partial output),
            // but keep this as a safety net.
            await convexClient.mutation(api.functions.messages.updateMessageById, {
              sessionId,
              messageId: assistantMessageId,
              updates: { resumableStreamId: null, status: "complete" },
            });

            logger.info("[Chat] Request finished as aborted", { userId, threadId, requestId });
            return;
          }

          const parts = responseMessage.parts as ChatMessage["parts"];
          const fileParts = parts.filter((part) => part.type === "file");

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

            const url = file.mediaType.includes("image")
              ? `https://ik.imagekit.io/gmethsnvl/ai-chat/${data.filePathname}`
              : `https://files.chat.asakuri.me/${data.filePathname}`;

            attachmentIds.push(data.attachmentDocId);
            fileParts[index]!.url = url;
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
          });

          await convexClient.mutation(api.functions.messages.updateMessageById, {
            sessionId,
            updates,
            messageId: assistantMessageId,
          });
        },
      });
    } catch (error) {
      const requestId = ctx.get("requestId");
      const err = error instanceof Error ? error : new Error(String(error));

      logger.error("[Chat Fatal Error]: " + err.message, {
        userId,
        requestId,
        stack: err.stack,
      });

      return Response.json({ error: { message: "Internal server error" } }, { status: 500 });
    }
  });
}
