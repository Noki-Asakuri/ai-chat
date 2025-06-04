import { env } from "@/env";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { waitUntil } from "@vercel/functions";
import { Redis } from "ioredis";
import { after, type NextRequest } from "next/server";
import { createResumableStreamContext } from "resumable-stream/ioredis";
import { z } from "zod/v4";

import { createDeepSeek } from "@ai-sdk/deepseek";
import { createGoogleGenerativeAI, type GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import { createOpenAI, type OpenAIResponsesProviderOptions } from "@ai-sdk/openai";
import { createDataStream, createProviderRegistry, generateId, generateText, streamText, type AISDKError } from "ai";

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
  config: z
    .object({
      webSearch: z.boolean(),
      reasoning: z.boolean(),
      model: z.string(),
    })
    .partial()
    .optional(),
});

async function updateTitle(messages: { role: string; content: string }[], threadId: string) {
  if (messages.length > 1 || !messages[0] || !threadId) return;
  console.debug("[Server] Updating thread title", threadId);

  const { text } = await generateText({
    model: registry.languageModel("google/gemini-2.5-flash-preview-05-20"),
    providerOptions: {
      google: { thinkingConfig: { thinkingBudget: 0 } } satisfies GoogleGenerativeAIProviderOptions,
    },
    messages: [
      {
        role: "system",
        content:
          "You are a conversational assistant and you need to summarize the user's text into a title of 10 words or less.",
      },
      {
        role: "user",
        content: `User: ${messages[0].content}

Please summarize the above conversation into a title of 10 words or less, without punctuation.`,
      },
    ],
  });

  await serverConvexClient.mutation(api.threads.updateThreadTitle, {
    threadId: threadId as Id<"threads">,
    title: text,
  });
}

export async function POST(req: Request) {
  const { success, data, error } = inputSchema.safeParse(await req.json());

  if (!success) {
    return Response.json({ error: { message: z.prettifyError(error) } }, { status: 400 });
  }

  const { messages, assistantMessageId: _assistantMessageId, threadId, config } = data;
  const assistantMessageId = _assistantMessageId as Id<"messages">;
  const streamId = generateId();

  const providerOptions = {
    google: { thinkingConfig: { includeThoughts: true, thinkingBudget: 0 } } as GoogleGenerativeAIProviderOptions,
    openai: {} as OpenAIResponsesProviderOptions,
  };

  if (config?.reasoning && config.model?.includes("gemini-2.5")) {
    providerOptions.google = {
      // Unset thinking budget to allow auto budgeting by Google
      thinkingConfig: { includeThoughts: true },
    };
  }

  const startTime = Date.now();
  const result = streamText({
    model: registry.languageModel("google/gemini-2.5-flash-preview-05-20"),
    system: "You are a helpful assistant.",
    messages,
    providerOptions,
    abortSignal: req.signal,

    async onError({ error }) {
      const err = error as AISDKError;
      console.log("[Chat] Error:", { err, req: req.signal });

      if (err.name === "AbortError" && req.signal.aborted) return;
      await serverConvexClient.mutation(api.messages.updateMessageById, {
        messageId: assistantMessageId,
        updates: { status: "error", error: err.message },
      });
    },
  });

  await serverConvexClient.mutation(api.messages.updateMessageById, {
    messageId: assistantMessageId,
    updates: { resumableStreamId: streamId, status: "streaming" },
  });

  waitUntil(updateTitle(messages, threadId));

  const stream = createDataStream({
    async execute(dataStream) {
      let content = "";
      let reasoning = "";
      let model = "";

      const metadata = {
        duration: 0,
        finishReason: "",
        totalTokens: 0,
        thinkingTokens: 0,
      };

      result.mergeIntoDataStream(dataStream, {
        sendUsage: false,
        sendReasoning: true,
        experimental_sendStart: false,
        experimental_sendFinish: false,
      });

      for await (const stream of result.fullStream) {
        switch (stream.type) {
          case "error":
            console.log(stream);
            break;

          case "step-start":
            break;

          case "reasoning":
            reasoning += stream.textDelta;
            break;

          case "text-delta":
            content += stream.textDelta;
            break;

          case "step-finish":
            model = stream.response.modelId;

            metadata.duration = Date.now() - startTime;
            metadata.finishReason = stream.finishReason;
            metadata.totalTokens = stream.usage.completionTokens;

            await serverConvexClient.mutation(api.messages.updateMessageById, {
              messageId: assistantMessageId,
              updates: { status: "complete", model, content, reasoning, resumableStreamId: null, metadata },
            });
            break;

          case "finish":
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
