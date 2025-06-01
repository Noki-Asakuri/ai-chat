import { env } from "@/env";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { waitUntil } from "@vercel/functions";
import { after, type NextRequest } from "next/server";
import { createResumableStreamContext } from "resumable-stream/ioredis";
import { Redis } from "ioredis";
import { z } from "zod/v4";

import { createGoogleGenerativeAI, type GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createDataStream, createProviderRegistry, generateId, streamText, type AISDKError } from "ai";

import { serverConvexClient } from "@/lib/convex/server";

const openai = createOpenAI({ baseURL: env.PROXY_URL, apiKey: env.PROXY_KEY });
const deepseek = createDeepSeek({ baseURL: env.PROXY_URL + "/deepseek", apiKey: env.PROXY_KEY });
const google = createGoogleGenerativeAI({
  apiKey: env.PROXY_KEY,
  baseURL: env.PROXY_URL + "/v1beta/",
  headers: { Authorization: `Bearer ${env.PROXY_KEY}` },
});

const registry = createProviderRegistry({ google, openai, deepseek }, { separator: "/" });

const publisher = new Redis(env.REDIS_URL);
const subscriber = new Redis(env.REDIS_URL);

const streamContext = createResumableStreamContext({
  waitUntil: after,
  publisher: publisher,
  subscriber: subscriber,
});

const inputSchema = z.object({
  messages: z.array(
    z.object({
      id: z.string(),
      role: z.enum(["assistant", "user"]),
      content: z.string(),
    }),
  ),
  assistantMessageId: z.string(),
  threadId: z.string(),
});

export async function POST(req: Request) {
  const { success, data, error } = inputSchema.safeParse(await req.json());

  if (!success) {
    return Response.json({ error: { message: z.prettifyError(error) } }, { status: 400 });
  }

  const { messages, assistantMessageId: _assistantMessageId } = data;
  const assistantMessageId = _assistantMessageId as Id<"messages">;
  const streamId = generateId();

  const startTime = Date.now();
  const result = streamText({
    model: registry.languageModel("deepseek/deepseek-reasoner"),
    system: "You are a helpful assistant.",
    messages,
    providerOptions: {
      google: { thinkingConfig: { includeThoughts: true } } satisfies GoogleGenerativeAIProviderOptions,
    },
    async onError({ error }) {
      const err = error as AISDKError;

      await serverConvexClient.mutation(api.messages.updateMessageById, {
        messageId: assistantMessageId,
        updates: { status: "error", content: err.message },
      });
    },
  });

  await serverConvexClient.mutation(api.messages.updateMessageById, {
    messageId: assistantMessageId,
    updates: { resumableStreamId: streamId },
  });

  waitUntil(result.consumeStream());
  const stream = createDataStream({
    async execute(dataStream) {
      let content = "";
      let reasoning = "";
      let model = "";

      result.mergeIntoDataStream(dataStream, {
        sendUsage: false,
        sendReasoning: true,
        experimental_sendStart: false,
        experimental_sendFinish: false,
      });

      for await (const stream of result.fullStream) {
        switch (stream.type) {
          case "step-start":
            await serverConvexClient.mutation(api.messages.updateMessageById, {
              messageId: assistantMessageId,
              updates: { status: "streaming" },
            });
            break;

          case "reasoning":
            reasoning += stream.textDelta;
            break;

          case "text-delta":
            content += stream.textDelta;
            break;

          case "step-finish":
            model = stream.response.modelId;
            break;

          case "finish":
            const duration = Date.now() - startTime;

            dataStream.writeData({
              type: "metadata",
              metadata: {
                duration,
                finishReason: stream.finishReason,
                totalTokens: stream.usage.completionTokens,
                thinkingTokens: 0,
              },
            });

            await serverConvexClient.mutation(api.messages.updateMessageById, {
              messageId: assistantMessageId,
              updates: {
                status: "complete",
                content,
                reasoning,
                model,
                resumableStreamId: null,
                metadata: {
                  duration,
                  finishReason: stream.finishReason,
                  totalTokens: stream.usage.completionTokens,
                  thinkingTokens: 0,
                },
              },
            });
            break;
        }
      }
    },
  });

  return new Response(await streamContext.resumableStream(streamId, () => stream), {
    headers: { "Content-Type": "text/event-stream" },
  });
}

export async function GET(req: NextRequest) {
  const streamId = req.nextUrl.searchParams.get("streamId");
  const resumeAt = req.nextUrl.searchParams.get("resumeAt");

  if (!streamId) {
    return Response.json({ error: { message: "Missing streamId" } }, { status: 400 });
  }

  const stream = await streamContext.resumeExistingStream(streamId, resumeAt ? parseInt(resumeAt) : undefined);
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream" },
  });
}
