import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";

import dedent from "dedent";
import { Redis } from "ioredis";
import { execSync } from "node:child_process";
import { createResumableStreamContext } from "resumable-stream/ioredis";
import { decodeJwt } from "jose";

import { APICallError, smoothStream, stepCountIs, streamText, UI_MESSAGE_STREAM_HEADERS } from "ai";

import { handleFileCaching } from "./handle-file-caching";

import { logger } from "@/lib/axiom/logger";
import { createServerConvexClient } from "@/lib/convex/server";
import { serverUploadFileR2 } from "@/lib/server/file-upload";
import { registry } from "@/lib/server/model-registry";
import { updateTitle } from "@/lib/server/update-title";
import { validateRequestBody } from "@/lib/server/validate-request-body";
import type { ChatMessage } from "@/lib/types";
import { tryCatch } from "@/lib/utils";

import { env } from "@/env";
import { decryptSession } from "@/lib/authkit/ssr/session";
import type { AccessToken } from "@workos-inc/node";

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
    allowHeaders: ["Authorization", "Content-Type", "Cookie"],
    exposeHeaders: ["Content-Type", "X-Request-Id"],
    credentials: true,
    maxAge: 604_800,
  }),
);

app.get("/", (ctx) => {
  const payload = {
    status: "ok",
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

// Resume stream route
app.get("/api/ai/chat", async (ctx) => {
  const { streamId } = ctx.req.query();
  if (!streamId) {
    logger.error("[Chat Error]: Missing streamId!", { streamId });
    return Response.json({ error: { message: "Error: Missing streamId!" } }, { status: 400 });
  }

  logger.info("[Chat] Resuming chat streaming!", { streamId });

  const stream = await streamContext.resumeExistingStream(streamId);

  if (!stream) {
    logger.error("[Chat Error]: Stream not found!", { streamId });
    return Response.json({ error: { message: "Error: Stream not found!" } }, { status: 404 });
  }

  return new Response(stream, {
    headers: {
      ...UI_MESSAGE_STREAM_HEADERS,
      "Transfer-Encoding": "chunked",
      "Content-Type": "text/event-stream; charset=utf-8",
    },
  });
});

app.post("/api/ai/chat", async (ctx) => {
  const req = ctx.req;

  const requestId = ctx.get("requestId");
  const cookie = req.header("Cookie");

  const wosSessionEncrypted = cookie?.match(/wos-session=([^;]+)/)?.[1] ?? "";
  const wosSession = await decryptSession(wosSessionEncrypted ?? "");

  const userId = wosSession.user.id;
  const { sid: sessionId } = decodeJwt<AccessToken>(wosSession.accessToken);

  logger.info("[Chat] Chat request received", { userId, requestId });

  if (!userId || !sessionId) {
    logger.error("[Chat Error]: Unauthenticated POST request!", { userId, sessionId });
    return Response.json({ error: { message: "Error: Unauthenticated!" } }, { status: 401 });
  }

  const convexClient = createServerConvexClient();

  try {
    const body = await req.json();

    const [requestBody, validateError] = await tryCatch(validateRequestBody(body));
    if (validateError) {
      logger.error("[Chat Error]: Failed to parse request body!", {
        error: validateError,
        userId: userId,
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
        userId: userId,
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

    const profilePrompt = modelParams.profile?.systemPrompt?.trim();
    if (profilePrompt && profilePrompt.length > 0) {
      systemInstruction += dedent`\n
		<profile>
		## AI Profile Instruction:
		User defined instruction. This is the most important instruction. It should take precedence over the global system instruction.

		${profilePrompt}

		<traits>
		## Traits (Optional):
		You should have these traits: ${userCustomization?.customization?.traits?.join(", ") ?? "None"}.
		</traits>
		</profile>
		`;
    }

    const startTime = Date.now();

    const result = streamText({
      model: registry(model.id),
      system: systemInstruction.trim(),
      messages: modelMessages,
      providerOptions,
      tools,

      experimental_telemetry: { isEnabled: false },

      maxRetries: 5,
      stopWhen: stepCountIs(5),

      experimental_transform: smoothStream({ delayInMs: 10, chunking: "line" }),
      experimental_download: (options) => Promise.all(options.map(handleFileCaching)),

      async onError({ error }) {
        const err = error as Error;
        let errorMessage = `An error have occurred. Please try again. \n\nError: ${err.message}`;

        if (err.name === "AbortError" && ctx.req.raw.signal.aborted) return;

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

        console.log(errorMessage);

        logger.error("[Chat Error]: " + err.message, {
          userId: userId,
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
      finishReason: "",
      timeToFirstTokenMs: 0,
      usages: { inputTokens: 0, outputTokens: 0, reasoningTokens: 0 },
      durations: { request: 0, reasoning: 0, text: 0 },

      modelParams,
    };

    // if (config.profile) metadata.profile = { id: config.profile.id, name: config.profile.name };

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
      sendFinish: true,
      sendStart: true,
      status: 200,
      headers: {
        ...UI_MESSAGE_STREAM_HEADERS,
        "Transfer-Encoding": "chunked",
        "Content-Type": "text/event-stream; charset=utf-8",
      },
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
        if (isAborted) {
          await convexClient.mutation(api.functions.messages.updateMessageById, {
            sessionId,
            messageId: assistantMessageId,
            updates: { resumableStreamId: null, status: "complete" },
          });

          logger.info("[Chat] Request was aborted by the client", { userId, threadId, requestId });
          return;
        }

        const parts = responseMessage.parts as ChatMessage["parts"];
        const fileParts = parts.filter((part) => part.type === "file");

        const attachmentIds: Id<"attachments">[] = [];
        const generatedFiles = (await result.files).map(async (file, index) => {
          const data = await serverUploadFileR2({
            threadId,
            sessionId,
            buffer: file.uint8Array,
            mediaType: file.mediaType,
            serverConvexClient: convexClient,
          });

          if (!data) return;

          attachmentIds.push(data.attachmentDocId);
          fileParts[index]!.url = data.filePathname;
        });

        await Promise.all(generatedFiles);

        type Updates = (typeof api.functions.messages.updateMessageById)["_args"]["updates"];
        const updates: Updates = {
          parts,
          metadata,
          resumableStreamId: null,
          status: "complete" as const,

          attachments: attachmentIds,
        };

        logger.info("[Chat] Chat request completed!", {
          userId: userId,
          threadId,
          assistantMessageId,
          model: model.uniqueId,
          profileId: modelParams.profile?.id,
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
    const req = ctx.req;
    const userId = req.header("X-User-Id");
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

process.on("unhandledRejection", (reason) => {
  logger.error("[Server] Unhandled Rejection", { reason });
});

process.on("uncaughtException", (err) => {
  logger.error("[Server] Uncaught Exception", { message: err.message, stack: err.stack });
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
