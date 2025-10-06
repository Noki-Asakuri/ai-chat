import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { serverConvexClient } from "@/lib/convex/server";

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";

import dedent from "dedent";
import { Redis } from "ioredis";
import { execSync } from "node:child_process";

import {
  createUIMessageStream,
  smoothStream,
  stepCountIs,
  streamText,
  type AISDKError,
  type Experimental_DownloadFunction,
} from "ai";

import { logger as baseLogger } from "@/lib/axiom/logger";
import { registry } from "@/lib/server/model-registry";
import { updateTitle } from "@/lib/server/update-title";
import { validateRequestBody } from "@/lib/server/validate-request-body";
import { fixMarkdownCodeBlocks, tryCatch, tryCatchSync } from "@/lib/utils";

import { env } from "@/env";
import { serverUploadFileR2 } from "@/lib/server/file-upload";

const cacheRedis = new Redis(env.REDIS_URL);

// Server lifecycle + observability
const serverStartedAt = Date.now();
let shuttingDown = false;
let activeRequests = 0;
let activeStreams = 0;

type LogParams = Parameters<typeof baseLogger.info>;

const logger = {
  info: function (...args: LogParams) {
    console.log(...args);
    baseLogger.info(...args);
  },
  error: function (...args: LogParams) {
    console.error(...args);
    baseLogger.error(...args);
  },
  warn: function (...args: LogParams) {
    console.warn(...args);
    baseLogger.warn(...args);
  },
};

function getCommitSha() {
  // Prefer explicit env provided via Docker build/run
  const envSha = process.env.GIT_COMMIT_SHA || process.env.COMMIT_SHA;
  if (envSha && envSha.length > 0) return envSha;

  // Fallback to git command (requires .git directory available in image)
  try {
    const out = execSync("git rev-parse --short=12 HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    });
    const sha = out.toString("utf8").trim();
    if (sha) return sha;
  } catch {
    // ignore and fall through
  }

  return "unknown";
}

const app = new Hono();
const commitSha = getCommitSha();

app.use(requestId());
app.use(honoLogger());
app.use(secureHeaders());

// Graceful-drain aware middleware: block new requests during shutdown and track in-flight work
app.use("*", async (ctx, next) => {
  if (shuttingDown) {
    const message = "Server is shutting down, please retry in a moment.";
    return ctx.json({ message: { message } }, 503);
  }

  activeRequests++;
  await tryCatch(next());

  activeRequests = Math.max(0, activeRequests - 1);
});

app.use(
  "/api/*",
  cors({
    origin: env.NODE_ENV === "production" ? "https://chat.asakuri.me" : "http://localhost:3000",
    allowMethods: ["POST", "GET", "OPTIONS"],
    allowHeaders: ["Authorization", "Upgrade-Insecure-Requests", "X-User-Id"],
    exposeHeaders: ["Content-Length", "Content-Type", "X-Request-Id"],
    maxAge: 3600,
    credentials: true,
  }),
);

// Index route: uptime + current git commit sha
app.get("/", (ctx) => {
  const payload = {
    status: "ok" as const,
    uptimeSeconds: Math.round(process.uptime()),
    startedAt: new Date(serverStartedAt).toISOString(),
    commitSha,
    shuttingDown,
    inFlight: activeRequests + activeStreams,
  };
  return ctx.json(payload);
});

// Health check route for Docker/K8s
app.get("/health", (ctx) => ctx.text("OK"));

app.post("/api/ai/chat", async (ctx) => {
  const req = ctx.req;

  const userId = req.header("X-User-Id");
  const requestId = ctx.get("requestId");
  const authToken = req.header("Authorization");

  logger.info("[Chat] Chat request received", { userId, requestId });

  if (!authToken || !userId) {
    logger.error("[Chat Error]: Unauthenticated POST request!");
    return Response.json({ error: { message: "Error: Unauthenticated!" } }, { status: 401 });
  }

  try {
    const body = await req.json();
    serverConvexClient.setAuth(authToken.replace("Bearer ", ""));

    const [requestBody, validateError] = tryCatchSync(() => validateRequestBody(body, userId));
    if (validateError) {
      logger.error("[Chat Error]: Failed to parse request body!", {
        error: validateError,
        userId: userId,
      });
      return Response.json({ error: { message: validateError.message } }, { status: 400 });
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
    } = requestBody;

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
        userId: userId,
        used: usage.used,
        base: usage.base,
      });

      return Response.json(
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

    const startTime = Date.now();

    const result = streamText({
      model: registry.languageModel(model.id),
      system: systemInstruction.trim(),
      messages: transformedMessages,
      providerOptions,
      tools,
      abortSignal: ctx.req.raw.signal,

      stopWhen: stepCountIs(5),
      experimental_transform: smoothStream({ delayInMs: 10, chunking: "line" }),

      experimental_download: async (options) => {
        type OutputType = Awaited<ReturnType<Experimental_DownloadFunction>>[number];

        return await Promise.all(
          options.map(async ({ url, isUrlSupportedByModel }): Promise<OutputType> => {
            const normalizedUrl = url.pathname.slice(1).replace("/", ":");
            const cacheKey = `${env.NODE_ENV}:attachment:${normalizedUrl}`;

            const [cachedBuffer, cachedMediaType] = await Promise.all([
              cacheRedis.getBuffer(cacheKey),
              cacheRedis.get(`${cacheKey}:mediaType`),
            ]);

            const hit = Boolean(cachedBuffer) && Boolean(cachedMediaType);

            logger.info(`[Chat Cache] ${url}`, {
              url,
              isUrlSupportedByModel,
              status: hit ? "HIT" : "MISS",
              cacheKey,
            });

            if (hit && cachedBuffer && cachedMediaType) {
              return { data: cachedBuffer, mediaType: cachedMediaType };
            }

            const res = await fetch(url);

            const arrayBuffer = await res.arrayBuffer();
            const mediaType = res.headers.get("content-type")!;
            const buffer = Buffer.from(arrayBuffer);

            async function saveCache() {
              const expireTime = 12 * 60 * 60;

              await Promise.allSettled([
                cacheRedis.set(cacheKey, buffer, "EX", expireTime),
                cacheRedis.set(`${cacheKey}:mediaType`, mediaType, "EX", expireTime),
              ]);
            }

            // Expire after 12h; store raw buffer. Not awaited so it doesn't block the response.
            tryCatch(saveCache());

            return { data: buffer, mediaType };
          }),
        );
      },

      async onError({ error }) {
        const err = error as AISDKError;
        // Skip proxy-related type validation errors as they are expected during proxy configuration
        if (err.name === "AI_TypeValidationError" && err.message.includes("proxy-")) return;

        logger.error("[Chat Error]: " + err.message, {
          userId: userId,
          threadId,
          assistantMessageId,
          model: model.uniqueId,
          errorName: err.name,
        });

        if (err.name === "AbortError" && ctx.req.raw.signal.aborted) return;

        await serverConvexClient.mutation(api.functions.usages.refundRequest, { amount: 1 });
        await serverConvexClient.mutation(api.functions.messages.updateErrorMessage, {
          error: err.message,
          model: model.uniqueId,
          messageId: assistantMessageId,
        });
      },
    });

    await serverConvexClient.mutation(api.functions.messages.updateMessageById, {
      messageId: assistantMessageId,
      updates: { status: "streaming", resumableStreamId: requestId, model: model.uniqueId },
    });

    const attachmentIds: Id<"attachments">[] = [];
    const metadata = {
      model: model.uniqueId,
      aiProfileId: config.profile?.id ?? undefined,
      duration: 0,
      finishReason: "",
      totalTokens: 0,
      thinkingTokens: 0,
      timeToFirstTokenMs: 0,
      usages: { inputTokens: 0, outputTokens: 0, reasoningTokens: 0 },
      durations: { request: 0, reasoning: 0, text: 0 },
    } satisfies Doc<"messages">["metadata"];

    void updateTitle(messages, threadId);

    const chatStream = createUIMessageStream({
      execute: async ({ writer }) => {
        let reasoningStartTime = 0;
        let textStartTime = 0;

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

            case "file":
              const attachmentId = await serverUploadFileR2({
                buffer: stream.file.uint8Array,
                mediaType: stream.file.mediaType,
                threadId,
              });

              if (attachmentId) {
                attachmentIds.push(attachmentId);

                logger.info("[Chat] File received", {
                  userId: userId,
                  threadId,
                  assistantMessageId,
                  model: model.uniqueId,
                  attachmentId,
                });
              } else {
                logger.error("[Chat Error]: Failed to upload file", {
                  userId: userId,
                  threadId,
                  assistantMessageId,
                  model: model.uniqueId,
                });
              }

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

              metadata.usages.inputTokens = stream.totalUsage.inputTokens ?? 0;
              metadata.usages.outputTokens = stream.totalUsage.outputTokens ?? 0;
              metadata.usages.reasoningTokens = stream.totalUsage.reasoningTokens ?? 0;

              if (model.id.startsWith("openai/gpt-5")) {
                // OpenAI GPT 5 output token also includes the reasoning tokens
                // In case AI SDK change and remove reasoning tokens from output
                // Then we revert back to original total tokens
                const actualOutputTokens = Math.min(
                  metadata.totalTokens - metadata.thinkingTokens,
                  metadata.totalTokens,
                );

                metadata.totalTokens = actualOutputTokens;
                metadata.usages.outputTokens = actualOutputTokens;
              }
              break;
          }
        }
      },

      onFinish: async ({ responseMessage }) => {
        const content = responseMessage.parts
          .filter((part) => part.type === "text")
          .map((part) => part.text)
          .join("");

        const reasoning = responseMessage.parts
          .filter((part) => part.type === "reasoning")
          .map((part) => part.text)
          .join("\n\n");

        type Updates = (typeof api.functions.messages.updateMessageById)["_args"]["updates"];
        const updates: Updates = {
          metadata,
          model: model.uniqueId,
          resumableStreamId: null,
          status: "complete" as const,

          attachments: attachmentIds,

          content: fixMarkdownCodeBlocks(content),
          reasoning: reasoning.length > 0 ? reasoning : undefined,

          modelParams: { webSearchEnabled: config.webSearch, effort: config.effort },
        };

        logger.info("[Chat] Chat request completed!", {
          userId: userId,
          threadId,
          assistantMessageId,
          model: model.uniqueId,
          metadata,
          requestId,
          dataLength: {
            content: updates.content?.length ?? 0,
            reasoning: updates.reasoning?.length ?? 0,
            attachments: attachmentIds.length,
          },
        });

        if (updates.content?.length === 0) {
          updates.content = `Upstream returned empty content. Stop reason: ${metadata.finishReason}`;
          logger.info("[Chat]: Upstream returned empty content!", {
            userId: userId,
            threadId,
            assistantMessageId,
            model: model.uniqueId,
            metadata,
          });
        }

        await serverConvexClient.mutation(api.functions.messages.updateMessageById, {
          messageId: assistantMessageId,
          updates,
        });
      },
    });

    // Track long-lived SSE stream as in-flight work for graceful shutdown
    let streamEnded = false;
    const markStreamEnded = () => {
      if (!streamEnded) {
        streamEnded = true;
        activeStreams = Math.max(0, activeStreams - 1);
      }
    };

    activeStreams++;

    const reader = chatStream.getReader();
    const readableStream = new ReadableStream<string>({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done || ctx.req.raw.signal.aborted) break;
            controller.enqueue("data: " + JSON.stringify(value) + "\n\n");
          }

          if (!ctx.req.raw.signal.aborted) controller.enqueue("data: [DONE]\n\n");
        } finally {
          // Ensure we count the stream as finished regardless of how it ends
          markStreamEnded();
          controller.close();
        }
      },
    });

    ctx.req.raw.signal.onabort = async () => {
      logger.error("[Chat Error]: Chat request aborted!", {
        userId: userId,
        threadId,
        assistantMessageId,
        model: model.uniqueId,
        requestId,
      });

      await tryCatch(readableStream.cancel(new Error("Chat request aborted")));
      markStreamEnded();
    };

    return new Response(readableStream, {
      headers: {
        connection: "keep-alive",
        "Cache-Control": "no-cache",
        "Transfer-Encoding": "chunked",
        "Content-Type": "text/event-stream",
      },
    });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error("[Chat Error]: " + error.message, error);

    return new Response("Error: " + error.message, { status: 500 });
  }
});

process.on("SIGTERM", () => {
  shuttingDown = true;
  logger.info("[Server] SIGTERM received. Draining in-flight requests...", {
    inFlight: activeRequests + activeStreams,
  });

  const start = Date.now();
  const deadlineMs = 30_000;

  const interval = setInterval(() => {
    const inFlight = activeRequests + activeStreams;
    if (inFlight === 0 || Date.now() - start > deadlineMs) {
      clearInterval(interval);
      logger.info("[Server] Exiting process", { inFlight, waitedMs: Date.now() - start });
      // Exit with success to signal graceful shutdown
      process.exit(0);
    }
  }, 250);
});

console.log("[Server] Starting server...", { commitSha, env: env.NODE_ENV, port: 3001 });
export default {
  port: 3001,
  fetch: app.fetch,
  idleTimeout: 0,
  development: env.NODE_ENV === "development",
};
