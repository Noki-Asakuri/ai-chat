import type { Id } from "@/convex/_generated/dataModel";

import { z } from "zod/v4";

import { google, type GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import { openai, type OpenAIResponsesProviderOptions } from "@ai-sdk/openai";
import type { ModelMessage, ToolSet, UserContent } from "ai";

import { getModelData } from "../chat/models";
import { tryCatchSync } from "../utils";

export const threadIdSchema = z.custom<Id<"threads">>((data) => z.string().parse(data));
export const messageIdSchema = z.custom<Id<"messages">>((data) => z.string().parse(data));
export const attachmentIdSchema = z.custom<Id<"attachments">>((data) => z.string().parse(data));
export const profileIdSchema = z.custom<Id<"profiles">>((data) => z.string().parse(data));

const attachmentSchema = z.object({
  _id: attachmentIdSchema,
  threadId: threadIdSchema,
  id: z.string(),

  name: z.string(),
  size: z.number(),
  type: z.enum(["image", "pdf"]),
  path: z.string(),
});

const inputSchema = z.object({
  assistantMessageId: messageIdSchema,
  threadId: threadIdSchema,

  messages: z.array(
    z.object({
      id: z.string(),
      role: z.enum(["assistant", "user"]),
      content: z.string(),
      attachments: attachmentSchema.array().optional(),
    }),
  ),

  config: z.object({
    model: z.string(),
    webSearch: z.boolean().default(false),
    effort: z.enum(["minimal", "low", "medium", "high"]).default("medium"),
    profile: z
      .object({ id: profileIdSchema, name: z.string(), systemPrompt: z.string() })
      .nullish(),
  }),
});

export type ChatRequestBody = z.infer<typeof inputSchema>;

const safetySettings = [
  { threshold: "BLOCK_NONE", category: "HARM_CATEGORY_HARASSMENT" },
  { threshold: "BLOCK_NONE", category: "HARM_CATEGORY_HATE_SPEECH" },
  { threshold: "BLOCK_NONE", category: "HARM_CATEGORY_CIVIC_INTEGRITY" },
  { threshold: "BLOCK_NONE", category: "HARM_CATEGORY_DANGEROUS_CONTENT" },
  { threshold: "BLOCK_NONE", category: "HARM_CATEGORY_SEXUALLY_EXPLICIT" },
];

const reasoningToBudget = {
  minimal: 128,
  low: 1_024,
  medium: 10_000,
  high: 20_000,
};

export function validateRequestBody(body: Record<string, unknown>, userId: string) {
  const { success, data, error } = inputSchema.safeParse(body);
  if (!success) throw new Error(z.prettifyError(error));

  const { messages, assistantMessageId, threadId, config } = data;
  const [modelData, modelError] = tryCatchSync(() => {
    if (!config.model || config.model.length === 0) throw new Error("No model provided");
    return { data: getModelData(config.model), model: config.model };
  });

  if (modelError) throw new Error(`Invalid model: ${modelError.message}`);

  const { data: modelInfo, model } = modelData;
  const tools: ToolSet = {};
  const transformedMessages = transformMessages(messages, userId);

  const providerOptions = {
    openai: { store: false } as OpenAIResponsesProviderOptions,
    google: { safetySettings } as GoogleGenerativeAIProviderOptions,
  };

  providerOptions.google.thinkingConfig = {
    includeThoughts: !!modelInfo.capabilities.reasoning,
    thinkingBudget: 0,
  };

  if (modelInfo.capabilities.reasoning) {
    const effort = config.effort ?? "medium";

    providerOptions.openai.reasoningEffort = effort;
    providerOptions.openai.reasoningSummary = "detailed";
    providerOptions.openai.include = ["reasoning.encrypted_content"];

    providerOptions.google.thinkingConfig.thinkingBudget =
      reasoningToBudget[effort] ?? reasoningToBudget.medium;

    if (modelInfo.id === "google/gemini-3-pro") {
      // Right now it doesn't support thinking budget.
      delete providerOptions.google.thinkingConfig.thinkingBudget;
    }
  }

  switch (modelInfo.provider) {
    case "google":
      if (modelInfo.capabilities.generateImage) {
        delete providerOptions.google.thinkingConfig;
        providerOptions.google.responseModalities = ["TEXT", "IMAGE"];

        // Only gemini-3-pro-image supports setting image size.
        if (modelInfo.id === "google/gemini-3-pro-image") {
          providerOptions.google.imageConfig = { imageSize: "2K" };
        }
      }

      if (config?.webSearch && modelInfo.capabilities.webSearch) {
        tools.url_context = google.tools.urlContext({});
        tools.google_search = google.tools.googleSearch({});
      }
      break;

    case "openai":
      if (modelInfo.capabilities.generateImage) {
        tools.image_generation = openai.tools.imageGeneration({
          outputFormat: "webp",
          quality: "high",
        });
      }

      if (config?.webSearch && modelInfo.capabilities.webSearch) {
        tools.web_search = openai.tools.webSearch({});
      }
      break;
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

function transformMessages(messages: z.infer<typeof inputSchema>["messages"], _userId: string) {
  return messages.map((message): ModelMessage => {
    if (message.role === "assistant") return { role: "assistant", content: message.content };

    const parts = message.attachments
      ? message.attachments.map((attachment): Exclude<UserContent[number], string> => {
          if (attachment.type === "image") {
            const url = `https://ik.imagekit.io/gmethsnvl/ai-chat/${attachment.path}`;
            return { type: "image" as const, image: url };
          }

          if (attachment.type === "pdf") {
            const url = `https://files.chat.asakuri.me/${attachment.path}`;
            return { type: "file" as const, data: url, mediaType: "application/pdf" };
          }

          return {
            type: "text" as const,
            text: `https://files.chat.asakuri.me/${attachment.path}`,
          };
        })
      : [];

    return {
      role: "user",
      content:
        parts.length === 0 ? message.content : [{ type: "text", text: message.content }, ...parts],
    };
  });
}
