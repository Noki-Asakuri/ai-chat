import type { Id } from "@/convex/_generated/dataModel";

import { Redis } from "ioredis";
import { z } from "zod/v4";
import { waitUntil } from "@vercel/functions";

import { google, type GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import { type OpenAIResponsesProviderOptions } from "@ai-sdk/openai";
import type { ModelMessage, ToolSet, UserContent } from "ai";

import { AllModelIds, getModelData } from "../chat/models";

import { env } from "@/env";
import { logger } from "../axiom/server";

const inputSchema = z.object({
  messages: z.array(
    z.object({
      id: z.string(),
      role: z.enum(["assistant", "user"]),
      content: z.string(),
      attachments: z
        .array(
          z.object({
            _id: z.string(),
            id: z.string(),
            threadId: z.string(),

            name: z.string(),
            size: z.number(),
            type: z.enum(["image", "pdf"]),
          }),
        )
        .optional(),
    }),
  ),
  assistantMessageId: z.custom<Id<"messages">>((data) => z.string().parse(data)),
  threadId: z.custom<Id<"threads">>((data) => z.string().parse(data)),

  config: z
    .object({
      webSearch: z.boolean(),
      reasoningEffort: z.enum(["low", "medium", "high"]),
      thinkingBudget: z.number().min(0).max(32_768),

      model: z.string(),
      temperature: z.number().min(0).max(1),
      topP: z.number().min(0).max(1),
      topK: z.number().min(1).max(100),
      maxTokens: z.number().min(1024).max(128_000),
      presencePenalty: z.number().min(0).max(1),
      frequencyPenalty: z.number().min(0).max(1),

      profile: z.object({
        id: z.custom<Id<"ai_profiles">>((data) => z.string().parse(data)).nullable(),
        systemPrompt: z.string(),
      }),
    })
    .partial(),
});

const modelValidator = z.enum(AllModelIds).transform((model) => {
  return { id: getModelData(model).id, model };
});

const safetySettings = [
  { threshold: "BLOCK_NONE", category: "HARM_CATEGORY_HARASSMENT" },
  { threshold: "BLOCK_NONE", category: "HARM_CATEGORY_HATE_SPEECH" },
  { threshold: "BLOCK_NONE", category: "HARM_CATEGORY_CIVIC_INTEGRITY" },
  { threshold: "BLOCK_NONE", category: "HARM_CATEGORY_DANGEROUS_CONTENT" },
  { threshold: "BLOCK_NONE", category: "HARM_CATEGORY_SEXUALLY_EXPLICIT" },
];

export async function validateRequestBody(req: Request, userId: string) {
  const { success, data, error } = inputSchema.safeParse(await req.json());
  if (!success) {
    throw new Error(z.prettifyError(error));
  }

  const { messages, assistantMessageId, threadId, config } = data;
  const {
    success: modelSuccess,
    data: modelData,
    error: modelError,
  } = modelValidator.safeParse(config?.model);
  if (!modelSuccess) {
    throw new Error(z.prettifyError(modelError));
  }

  const { id, model } = modelData;

  const providerOptions = {
    google: { safetySettings } as GoogleGenerativeAIProviderOptions,
    openai: {} as OpenAIResponsesProviderOptions,
  };

  if (config?.thinkingBudget || config?.reasoningEffort) {
    const isThinkingModel = model.includes("-thinking");

    providerOptions.google.thinkingConfig = {
      includeThoughts: isThinkingModel,
      thinkingBudget: isThinkingModel ? config.thinkingBudget : 0,
    };

    providerOptions.openai = {
      reasoningSummary: "detailed",
      reasoningEffort: config.reasoningEffort,
      include: ["reasoning.encrypted_content"],

      store: false,
    };
  }

  if (model.includes("image")) {
    delete providerOptions.google.thinkingConfig;
    providerOptions.google.responseModalities = ["TEXT", "IMAGE"];
  }

  const tools: ToolSet = {};
  const transformedMessages = await Promise.all(transformMessages(messages, userId));

  if (config?.webSearch) {
    tools.google_search = google.tools.googleSearch({});
    tools.url_context = google.tools.urlContext({});
  }

  return {
    messages,
    transformedMessages,
    assistantMessageId,
    threadId,
    config,
    model: { id, uniqueId: model },
    providerOptions,
    tools,
  };
}

const redis = new Redis(env.REDIS_URL);

function transformMessages(messages: z.infer<typeof inputSchema>["messages"], userId: string) {
  return messages.map(async (message): Promise<ModelMessage> => {
    if (message.role === "assistant") return { role: "assistant", content: message.content };

    const attachmentParts = message.attachments
      ? message.attachments.map(
          async (attachment): Promise<Exclude<UserContent[number], string>> => {
            const url = `https://files.chat.asakuri.me/${userId}/${attachment.threadId}/${attachment._id}`;

            if (attachment.type === "image") {
              const cacheKey = `attachment:${userId}:${attachment.threadId}:${attachment._id}`;

              const cachedDataUrl = await redis.get(cacheKey);
              logger.info(`[Chat Cache] ${url}`, {
                url,
                status: cachedDataUrl ? "HIT" : "MISS",
                cacheKey,
              });

              if (cachedDataUrl) {
                return { type: "image" as const, image: cachedDataUrl };
              }

              const res = await fetch(url);
              const contentTypeHeader = res.headers.get("content-type");
              const mediaType = contentTypeHeader?.split(";")[0] ?? "image/png";

              const arrayBuffer = await res.arrayBuffer();
              const base64 = Buffer.from(arrayBuffer).toString("base64");
              const dataUrl = `data:${mediaType};base64,${base64}`;

              // Expire after 12h, single key, not await so doesn't block response
              waitUntil(redis.set(cacheKey, dataUrl, "EX", 12 * 60 * 60));

              return { type: "image" as const, image: dataUrl };
            }

            if (attachment.type === "pdf") {
              return { type: "file" as const, data: url, mediaType: "application/pdf" };
            }

            return { type: "text" as const, text: url };
          },
        )
      : [];

    const parts = (await Promise.allSettled(attachmentParts))
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);

    return {
      role: "user",
      content:
        parts.length === 0 ? message.content : [{ type: "text", text: message.content }, ...parts],
    };
  });
}
