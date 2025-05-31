import { env } from "@/env";

import { api } from "@/convex/_generated/api";

import { waitUntil } from "@vercel/functions";

import { createOpenAI } from "@ai-sdk/openai";
import { createDataStreamResponse, smoothStream, streamText } from "ai";

import { serverConvexClient } from "@/lib/convex/server";
import type { ChatRequest } from "@/lib/types";

const openai = createOpenAI({ baseURL: env.PROXY_URL, apiKey: env.PROXY_KEY });

export async function POST(req: Request) {
  const { messages, assistantMessageId } = (await req.json()) as ChatRequest;
  const startTime = Date.now();

  const result = streamText({
    model: openai("gpt-4.1-mini"),
    system: "You are a helpful assistant.",
    messages,
    experimental_transform: smoothStream({ chunking: "line", delayInMs: 20 }),
  });

  waitUntil(result.consumeStream());

  return createDataStreamResponse({
    status: 200,
    statusText: "OK",
    async execute(dataStream) {
      let content = "";

      for await (const stream of result.fullStream) {
        switch (stream.type) {
          case "text-delta":
            content += stream.textDelta;
            dataStream.writeData({ type: "text", textDelta: content });

            void serverConvexClient.mutation(api.messages.updateMessageById, {
              messageId: assistantMessageId,
              updates: { status: "streaming", content },
            });

            break;

          case "step-finish":
            break;

          case "finish":
            const duration = Date.now() - startTime;

            dataStream.writeData({
              type: "finish",
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
}
