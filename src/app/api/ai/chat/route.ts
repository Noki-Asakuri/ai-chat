import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { serverConvexClient } from "@/lib/convex/server";

import { auth } from "@clerk/nextjs/server";
import { waitUntil } from "@vercel/functions";
import dedent from "dedent";
import { Redis } from "ioredis";
import { after, NextResponse, type NextRequest } from "next/server";
import { createResumableStreamContext } from "resumable-stream/ioredis";

import {
  createUIMessageStream,
  generateId,
  smoothStream,
  stepCountIs,
  streamText,
  type AISDKError,
  type Experimental_DownloadFunction,
} from "ai";

import { logger, withAxiom } from "@/lib/axiom/server";
import { registry } from "@/lib/server/model-registry";
import { updateTitle } from "@/lib/server/update-title";
import { validateRequestBody } from "@/lib/server/validate-request-body";
import { fixMarkdownCodeBlocks, tryCatch } from "@/lib/utils";

import { env } from "@/env";
import { serverUploadFileR2 } from "@/lib/server/file-upload";

const publisher = new Redis(env.REDIS_URL);
const subscriber = new Redis(env.REDIS_URL);
const cacheRedis = new Redis(env.REDIS_URL);

const streamContext = createResumableStreamContext({
  waitUntil: after,
  publisher: publisher,
  subscriber: subscriber,
  keyPrefix: `${env.NODE_ENV}:resumable-stream`,
});

export const POST = withAxiom(async (req) => {
  try {
    const user = await auth();
    if (!user.userId) {
      logger.error("[Chat Error]: Unauthenticated POST request!", { user });
      return NextResponse.json({ error: { message: "Error: Unauthenticated!" } }, { status: 401 });
    }

    const authToken = await user.getToken({ template: "convex" });
    serverConvexClient.setAuth(authToken!);

    const [requestBody, validateError] = await tryCatch(validateRequestBody(req, user.userId));
    if (validateError) {
      logger.error("[Chat Error]: Failed to parse request body!", {
        error: validateError,
        userId: user.userId,
      });
      return NextResponse.json({ error: { message: validateError.message } }, { status: 400 });
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

            console.log({ url: url.toString(), isUrlSupportedByModel, hit: hit ? "HIT" : "MISS" });
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
            waitUntil(saveCache());

            return { data: buffer, mediaType };
          }),
        );
      },

      async onError({ error }) {
        const err = error as AISDKError;
        // Skip proxy-related type validation errors as they are expected during proxy configuration
        if (err.name === "AI_TypeValidationError" && err.message.includes("proxy-")) return;

        console.error("[Chat] Error:", err);
        logger.error("[Chat Error]: " + err.message, {
          userId: user.userId,
          threadId,
          assistantMessageId,
          model: model.uniqueId,
          errorName: err.name,
        });

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
      model: model.uniqueId,
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
        const attachmentIds: Id<"attachments">[] = [];

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

            case "file":
              const attachmentId = await serverUploadFileR2({
                buffer: stream.file.uint8Array,
                mediaType: stream.file.mediaType,
                threadId,
              });

              if (attachmentId) {
                attachmentIds.push(attachmentId);

                console.log("File received", stream.file.mediaType, attachmentId);
                logger.info("[Chat] File received", {
                  userId: user.userId,
                  threadId,
                  assistantMessageId,
                  model: model.uniqueId,
                  attachmentId,
                });
              } else {
                logger.error("[Chat Error]: Failed to upload file", {
                  userId: user.userId,
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

              if (model.id.startsWith("openai/gpt-5")) {
                // OpenAI GPT 5 output token also includes the reasoning tokens
                // In case AI SDK change and remove reasoning tokens from output
                // Then we revert back to original total tokens
                metadata.totalTokens = Math.min(
                  metadata.totalTokens - metadata.thinkingTokens,
                  metadata.totalTokens,
                );
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

          attachments: attachmentIds,

          content: fixMarkdownCodeBlocks(content),
          reasoning: reasoning.length > 0 ? reasoning : undefined,

          modelParams: { webSearchEnabled: config.webSearch, effort: config.effort },
        };

        console.log("[Chat] Chat request completed!", { userId: user.userId });
        logger.info("[Chat] Chat request completed!", {
          userId: user.userId,
          threadId,
          assistantMessageId,
          model: model.uniqueId,
          metadata,
        });

        if (updates.content?.length === 0) {
          updates.content = `Upstream returned empty content. Stop reason: ${metadata.finishReason}`;
          logger.info("[Chat]: Upstream returned empty content!", {
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

      await readableStream.cancel(new Error("Chat request aborted"));
    };

    return new Response(resumeableStream, {
      headers: {
        connection: "keep-alive",
        "Cache-Control": "no-cache",
        "Transfer-Encoding": "chunked",
        "Content-Type": "text/event-stream",
      },
    });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));

    console.error("[Chat] Error:", error);
    logger.error("[Chat Error]: " + error.message);

    return new Response("Error: " + error.message, { status: 500 });
  }
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
