import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { createServerConvexClient } from "@/lib/convex/server";

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";

import dedent from "dedent";
import { Redis } from "ioredis";
import { execSync } from "node:child_process";
import { createResumableStreamContext } from "resumable-stream/ioredis";

import { smoothStream, stepCountIs, streamText, type AISDKError } from "ai";

import { handleFileCaching } from "./handle-file-caching";

import { logger as baseLogger } from "@/lib/axiom/logger";
import { serverUploadFileR2 } from "@/lib/server/file-upload";
import { registry } from "@/lib/server/model-registry";
import { updateTitle } from "@/lib/server/update-title";
import { validateRequestBody } from "@/lib/server/validate-request-body";
import { fixMarkdownCodeBlocks, tryCatch, tryCatchSync } from "@/lib/utils";

import { env } from "@/env";

export const cacheRedis = new Redis(env.REDIS_URL);
const subscriber = cacheRedis.duplicate();
const publisher = cacheRedis;

const streamContext = createResumableStreamContext({
  waitUntil: async (task) => void (await tryCatch(task)),
  publisher: publisher,
  subscriber: subscriber,
  keyPrefix: `${env.NODE_ENV}:resumable-stream`,
});

// Server lifecycle + observability
const serverStartedAt = Date.now();
let shuttingDown = false;
let activeRequests = 0;
const activeStreams = 0;

type LogParams = Parameters<typeof baseLogger.info>;

export const logger = {
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

  const body = await req.json();
  const serverConvexClient = createServerConvexClient(authToken.replace("Bearer ", ""));

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

    experimental_telemetry: { isEnabled: false },

    maxRetries: 5,
    stopWhen: stepCountIs(5),

    experimental_transform: smoothStream({ delayInMs: 10, chunking: "line" }),
    experimental_download: (options) => Promise.all(options.map(handleFileCaching)),

    async onError({ error }) {
      const err = error as AISDKError;

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

  void updateTitle({ messages, threadId, serverConvexClient });

  let reasoningStartTime = 0;
  let textStartTime = 0;

  const attachmentPromises: Promise<Id<"attachments"> | null>[] = [];

  return result.toUIMessageStreamResponse({
    generateMessageId: () => requestId,
    consumeSseStream: async ({ stream }) => {
      logger.info("[Chat] Creating resumable stream", { userId, requestId, threadId });
      await streamContext.createNewResumableStream(requestId, () => stream);
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

        case "tool-result": {
          if (part.toolName !== "image_generation") break;

          const base64Image = part.output.result;
          const buffer = Buffer.from(base64Image, "base64");

          if (buffer.length === 0) break;

          const promise = serverUploadFileR2({
            threadId,
            buffer: buffer,
            mediaType: "image/webp",
            serverConvexClient,
          });

          attachmentPromises.push(promise);
          break;
        }

        case "file":
          const promise = serverUploadFileR2({
            threadId,
            buffer: part.file.uint8Array,
            mediaType: part.file.mediaType,
            serverConvexClient,
          });

          attachmentPromises.push(promise);
          break;

        case "finish-step":
          metadata.model = part.response.modelId;
          metadata.finishReason = part.finishReason;

          metadata.duration = Date.now() - startTime;
          metadata.durations.request = metadata.duration;
          break;

        case "finish":
          metadata.totalTokens = part.totalUsage.outputTokens ?? 0;
          metadata.thinkingTokens = part.totalUsage.reasoningTokens ?? 0;

          metadata.usages.inputTokens = part.totalUsage.inputTokens ?? 0;
          metadata.usages.outputTokens = part.totalUsage.outputTokens ?? 0;
          metadata.usages.reasoningTokens = part.totalUsage.reasoningTokens ?? 0;

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

      return null;
    },

    async onFinish({ responseMessage, isAborted }) {
      if (isAborted) {
        logger.info("[Chat] Request was aborted by the client", { userId, threadId, requestId });
        return;
      }

      const content = responseMessage.parts
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("");

      const reasoning = responseMessage.parts
        .filter((part) => part.type === "reasoning")
        .map((part) => part.text)
        .join("\n\n");

      const attachmentIds = await Promise.all(attachmentPromises).then((ids) =>
        ids.filter((id): id is Id<"attachments"> => id !== null),
      );

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

const PORT = process.env.PORT || 3001;
console.log("[Server] Server started!", { commitSha, env: env.NODE_ENV, port: PORT });

export default {
  port: PORT,
  fetch: app.fetch,
  idleTimeout: 0,
  development: env.NODE_ENV === "development",
};
