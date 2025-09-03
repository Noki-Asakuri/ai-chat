import type { Id } from "@/convex/_generated/dataModel";

import { waitUntil } from "@vercel/functions";
import { Redis } from "ioredis";
import { z } from "zod/v4";

import { google, type GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import { openai, type OpenAIResponsesProviderOptions } from "@ai-sdk/openai";
import type { ModelMessage, ToolSet, UserContent } from "ai";

import { logger } from "../axiom/server";
import { getModelData } from "../chat/models";
import { tryCatchSync } from "../utils";

import { env } from "@/env";

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
  const [modelData, modelError] = tryCatchSync(() => {
    if (!config.model || config.model.length === 0) throw new Error("No model provided");
    return { data: getModelData(config.model), model: config.model };
  });

  if (modelError) throw new Error(`Invalid model: ${modelError.message}`);

  const { data: modelInfo, model } = modelData;

  const providerOptions = {
    google: { safetySettings } as GoogleGenerativeAIProviderOptions,
    openai: { store: false } as OpenAIResponsesProviderOptions,
  };

  providerOptions.google.thinkingConfig = {
    includeThoughts: !!modelInfo.capabilities.reasoning,
    // Auto thinking budget if model can reasoning
    thinkingBudget: modelInfo.capabilities.reasoning ? -1 : 0,
  };

  if (modelInfo.capabilities.generateImage) {
    delete providerOptions.google.thinkingConfig;
    providerOptions.google.responseModalities = ["TEXT", "IMAGE"];
  }

  if (modelInfo.capabilities.reasoning) {
    providerOptions.openai.reasoningSummary = "detailed";
    providerOptions.openai.reasoningEffort = config.reasoningEffort ?? "medium";

    providerOptions.openai.include = ["reasoning.encrypted_content"];
  }

  const tools: ToolSet = {};
  const transformedMessages = await Promise.all(transformMessages(messages, userId));

  if (config?.webSearch) {
    switch (modelInfo.provider) {
      case "google":
        tools.google_search = google.tools.googleSearch({});
        tools.url_context = google.tools.urlContext({});
        break;

      case "openai":
        tools.web_search_preview = openai.tools.webSearchPreview({ searchContextSize: "high" });
        break;
    }
  }

  return {
    messages,
    transformedMessages,
    assistantMessageId,
    threadId,
    config,
    model: { id: modelInfo.id, uniqueId: model },
    providerOptions,
    tools,
  };
}

function transformMessages(messages: z.infer<typeof inputSchema>["messages"], userId: string) {
  return messages.map(async (message): Promise<ModelMessage> => {
    if (message.role === "assistant") return { role: "assistant", content: message.content };

    const attachmentParts = message.attachments
      ? message.attachments.map(
          async (attachment): Promise<Exclude<UserContent[number], string>> => {
            const url = `https://files.chat.asakuri.me/${userId}/${attachment.threadId}/${attachment._id}`;

            if (attachment.type === "image") {
              return {
                type: "image" as const,
                image: url,
                providerOptions: { openai: { imageDetail: "high" } },
              };
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
