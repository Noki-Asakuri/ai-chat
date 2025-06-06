import { env } from "@/env";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { serverConvexClient } from "@/lib/convex/server";

import { auth } from "@clerk/nextjs/server";
import { waitUntil } from "@vercel/functions";
import { Redis } from "ioredis";
import { after, NextResponse, type NextRequest } from "next/server";
import { createResumableStreamContext } from "resumable-stream/ioredis";
import { z } from "zod/v4";

import { createDeepSeek } from "@ai-sdk/deepseek";
import { createGoogleGenerativeAI, type GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import { createOpenAI, type OpenAIResponsesProviderOptions } from "@ai-sdk/openai";
import { createProviderRegistry, generateId, generateText, streamText, type AISDKError } from "ai";

import { AllModelIds } from "@/lib/chat/models";

const openai = createOpenAI({ baseURL: env.PROXY_URL, apiKey: env.PROXY_KEY });
const deepseek = createDeepSeek({ baseURL: env.PROXY_URL + "/deepseek", apiKey: env.PROXY_KEY });
const google = createGoogleGenerativeAI({ baseURL: env.PROXY_URL + "/v1beta/", apiKey: env.PROXY_KEY });

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
  assistantMessageId: z.custom<Id<"messages">>((data) => z.string().parse(data)),
  threadId: z.custom<Id<"threads">>((data) => z.string().parse(data)),
  config: z
    .object({
      webSearch: z.boolean(),
      reasoning: z.boolean(),
      model: z.string(),
    })
    .partial(),
});

const modelValidator = z
  .enum(AllModelIds)
  .default("google/gemini-2.5-flash-preview-05-20")
  .catch("google/gemini-2.5-flash-preview-05-20");

async function updateTitle(messages: { role: string; content: string }[], threadId: Id<"threads">) {
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
    threadId,
    title: text,
  });
}

export async function POST(req: Request) {
  const user = await auth();

  if (!user.userId) {
    return NextResponse.json({ error: { message: "Error: No signed in user" } }, { status: 401 });
  }
  const authToken = await user.getToken({ template: "convex" })!;
  if (!authToken) {
    return NextResponse.json({ error: { message: "Error: No convex auth token" } }, { status: 401 });
  }

  serverConvexClient.setAuth(authToken);

  const { success, data, error } = inputSchema.safeParse(await req.json());
  if (!success) {
    return Response.json({ error: { message: z.prettifyError(error) } }, { status: 400 });
  }

  const streamId = generateId();
  const { messages, assistantMessageId, threadId, config } = data;
  const model = modelValidator.parse(config?.model);

  const providerOptions = {
    google: {
      thinkingConfig: { includeThoughts: true, thinkingBudget: 0 },
      safetySettings: [
        { threshold: "BLOCK_NONE", category: "HARM_CATEGORY_HARASSMENT" },
        { threshold: "BLOCK_NONE", category: "HARM_CATEGORY_HATE_SPEECH" },
        { threshold: "BLOCK_NONE", category: "HARM_CATEGORY_CIVIC_INTEGRITY" },
        { threshold: "BLOCK_NONE", category: "HARM_CATEGORY_DANGEROUS_CONTENT" },
        { threshold: "BLOCK_NONE", category: "HARM_CATEGORY_SEXUALLY_EXPLICIT" },
      ],
    } as GoogleGenerativeAIProviderOptions,
    openai: {} as OpenAIResponsesProviderOptions,
  };

  if (config?.reasoning) {
    delete providerOptions.google.thinkingConfig?.thinkingBudget;
    providerOptions.openai = { reasoningEffort: "high" };
  }

  if (config?.webSearch) {
    providerOptions.google.useSearchGrounding = true;
  }

  const startTime = Date.now();
  const result = streamText({
    model: registry.languageModel(model),
    system: "You are a helpful assistant.",
    messages,
    providerOptions,
    abortSignal: req.signal,

    async onError({ error }) {
      const err = error as AISDKError;
      console.log("[Chat] Error:", { err, req: req.signal });

      if (err.name === "AbortError" && req.signal.aborted) return;
      await serverConvexClient.mutation(api.messages.updateErrorMessage, {
        messageId: assistantMessageId,
        error: err.message,
      });
    },
  });

  await serverConvexClient.mutation(api.messages.updateMessageById, {
    messageId: assistantMessageId,
    threadId,
    updates: {
      status: "streaming",
      resumableStreamId: streamId,
      modelParams: {
        enableWebSearch: config?.webSearch,
        enableThinking: config?.reasoning,
      },
    },
  });

  const metadata = {
    model,
    duration: 0,
    finishReason: "",
    totalTokens: 0,
    thinkingTokens: 0,
    providerOptions: undefined,
  } as {
    model: string;
    duration: number;
    finishReason: string;
    totalTokens: number;
    thinkingTokens: number;
    // providerOptions?: { openai: Record<string, JSONValue>; google: GoogleGenerativeAIProviderMetadata };
  };

  const reader = result
    .toUIMessageStream({
      sendFinish: true,
      sendReasoning: true,
      sendSources: true,
      sendStart: true,
      messageMetadata({ part }): Partial<typeof metadata> | undefined {
        if (part.type === "finish-step") {
          metadata.model = part.response.modelId;
          metadata.duration = Date.now() - startTime;
          metadata.finishReason = part.finishReason;
          // metadata.providerOptions = part.providerMetadata as (typeof metadata)["providerOptions"];
        }

        if (part.type === "finish") {
          metadata.totalTokens = part.totalUsage.outputTokens ?? 0;
          metadata.thinkingTokens = part.totalUsage.reasoningTokens ?? 0;

          return metadata;
        }
      },
    })
    .getReader();

  let content = "";
  let reasoning = "";
  const sources: { id: string; title?: string; url: string }[] = [];

  const readableStream = new ReadableStream<string>({
    async start(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done || req.signal.aborted) break;
        controller.enqueue("data: " + JSON.stringify(value) + "\n\n");

        switch (value.type) {
          case "text":
            content += value.text;
            break;

          case "reasoning":
            reasoning += value.text;
            break;

          case "source-url":
            sources.push({ id: value.sourceId, title: value.title, url: value.url });
            break;

          default:
            console.log(value);
            break;
        }
      }

      const updates = {
        model,
        content,
        metadata,
        resumableStreamId: null,
        status: "complete" as const,
        reasoning: reasoning.length > 0 ? reasoning.trim() : undefined,
      };

      if (!req.signal.aborted) {
        await serverConvexClient.mutation(api.messages.updateMessageById, {
          messageId: assistantMessageId,
          threadId,
          updates,
        });

        controller.enqueue("data: [DONE]\n\n");
      }

      serverConvexClient.clearAuth();
      return controller.close();
    },
  });
  const resumeableStream = await streamContext.resumableStream(streamId, () => readableStream);
  waitUntil(updateTitle(messages, threadId));

  req.signal.onabort = async () => {
    await reader.cancel(new Error("Request aborted"));
  };

  return new Response(resumeableStream, {
    headers: {
      connection: "keep-alive",
      "Cache-Control": "no-cache",
      "Transfer-Encoding": "chunked",
      "Content-Type": "text/event-stream",
    },
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
    headers: {
      connection: "keep-alive",
      "Cache-Control": "no-cache",
      "Transfer-Encoding": "chunked",
      "Content-Type": "text/event-stream",
    },
  });
}
