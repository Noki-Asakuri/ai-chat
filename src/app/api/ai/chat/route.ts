import { env } from "@/env";

import { api } from "@/convex/_generated/api";
import { fetchMutation } from "convex/nextjs";

import Redis from "ioredis";
import { createResumableStreamContext } from "resumable-stream/ioredis";
import { after } from "next/server";

import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

import type { ChatMetadata } from "@/lib/ai/metadata";

const openai = createOpenAI({ baseURL: env.PROXY_URL, apiKey: env.PROXY_KEY });
const redis = new Redis(env.REDIS_URL);

const streamContext = createResumableStreamContext({ waitUntil: after, ...redis });

export async function POST(req: Request, { params }: { params: Promise<{ streamId: string }> }) {
  const { messages, chatId } = (await req.json()) as { chatId: string; messages: UIMessage[] };
  const startTime = Date.now();

  const userMessage = messages[messages.length - 1]!;
  void fetchMutation(api.messages.addMessages, {
    threadId: chatId,
    message: { parts: userMessage.parts, role: userMessage.role },
  });

  const result = streamText({
    model: openai("gpt-4.1-mini"),
    system: "You are a helpful assistant.",
    messages: convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    onFinish({ responseMessage }) {
      void fetchMutation(api.messages.addMessages, {
        threadId: chatId,
        message: {
          role: responseMessage.role,
          parts: responseMessage.parts,
          metadata: responseMessage.metadata as Required<ChatMetadata> | undefined,
        },
      });
    },
    messageMetadata: ({ part }): ChatMetadata | undefined => {
      if (part.type === "start") {
        return { createdAt: Date.now() };
      }

      if (part.type === "finish-step") {
        return {
          model: part.response.modelId,
          duration: +((Date.now() - startTime) / 1000).toFixed(2),
        };
      }

      if (part.type === "finish") {
        return {
          finishReason: part.finishReason,
          totalTokens: part.totalUsage.totalTokens,
        };
      }
    },
  });
}
