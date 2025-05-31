import { env } from "@/env";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import throttle from "lodash.throttle";
import { waitUntil } from "@vercel/functions";
import { z } from "zod/v4";

import { createGoogleGenerativeAI, type GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createDataStreamResponse, createProviderRegistry, streamText, type AISDKError } from "ai";

import { serverConvexClient } from "@/lib/convex/server";

const openai = createOpenAI({ baseURL: env.PROXY_URL, apiKey: env.PROXY_KEY });
const google = createGoogleGenerativeAI({
  apiKey: env.PROXY_KEY,
  baseURL: env.PROXY_URL + "/v1beta/",
  headers: { Authorization: `Bearer ${env.PROXY_KEY}` },
});

const registry = createProviderRegistry({ google, openai }, { separator: "/" });

const updateMessage = throttle(
  async (data: { assistantMessageId: Id<"messages">; content?: string; reasoning?: string }) => {
    console.log("Run", Date.now());

    return serverConvexClient.mutation(api.messages.updateMessageById, {
      messageId: data.assistantMessageId,
      updates: { content: data.content, reasoning: data.reasoning },
    });
  },
  350,
);

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

  const startTime = Date.now();
  const result = streamText({
    model: registry.languageModel("google/gemini-2.5-flash-preview-04-17"),
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

  waitUntil(result.consumeStream());
  return createDataStreamResponse({
    status: 200,
    statusText: "OK",
    async execute(dataStream) {
      let content = "";
      let reasoning = "";
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
            void updateMessage({ assistantMessageId, reasoning });
            break;

          case "text-delta":
            content += stream.textDelta;
            void updateMessage({ assistantMessageId, content });
            break;

          case "step-finish":
            void serverConvexClient.mutation(api.messages.updateMessageById, {
              messageId: assistantMessageId,
              updates: { model: stream.response.modelId },
            });
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
