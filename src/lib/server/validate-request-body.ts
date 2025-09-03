import type { Id } from "@/convex/_generated/dataModel";

import { z } from "zod/v4";

import { google, type GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import { openai, type OpenAIResponsesProviderOptions } from "@ai-sdk/openai";
import type { ModelMessage, ToolSet, UserContent } from "ai";

import { getModelData } from "../chat/models";
import { tryCatchSync } from "../utils";

const threadIdSchema = z.custom<Id<"threads">>((data) => z.string().parse(data));
const messageIdSchema = z.custom<Id<"messages">>((data) => z.string().parse(data));
const attachmentIdSchema = z.custom<Id<"attachments">>((data) => z.string().parse(data));

const inputSchema = z.object({
  messages: z.array(
    z.object({
      id: z.string(),
      role: z.enum(["assistant", "user"]),
      content: z.string(),
      attachments: z
        .array(
          z.object({
            _id: attachmentIdSchema,
            id: z.string(),
            threadId: threadIdSchema,

            name: z.string(),
            size: z.number(),
            type: z.enum(["image", "pdf"]),
          }),
        )
        .optional(),
    }),
  ),
  assistantMessageId: messageIdSchema,
  threadId: threadIdSchema,

  config: z
    .object({
      webSearch: z.boolean().optional(),
      effort: z.enum(["low", "medium", "high"]).default("medium"),

      model: z.string(),
      profile: z.object({
        id: z.custom<Id<"ai_profiles">>((data) => z.string().parse(data)).nullable(),
        systemPrompt: z.string(),
      }),
    })
    .partial(),
});

export type RequestBody = z.infer<typeof inputSchema>;

const safetySettings = [
  { threshold: "BLOCK_NONE", category: "HARM_CATEGORY_HARASSMENT" },
  { threshold: "BLOCK_NONE", category: "HARM_CATEGORY_HATE_SPEECH" },
  { threshold: "BLOCK_NONE", category: "HARM_CATEGORY_CIVIC_INTEGRITY" },
  { threshold: "BLOCK_NONE", category: "HARM_CATEGORY_DANGEROUS_CONTENT" },
  { threshold: "BLOCK_NONE", category: "HARM_CATEGORY_SEXUALLY_EXPLICIT" },
];

export async function validateRequestBody(req: Request, userId: string) {
  const { success, data, error } = inputSchema.safeParse(await req.json());
  if (!success) throw new Error(z.prettifyError(error));

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
    providerOptions.openai.reasoningEffort = config.effort ?? "medium";

    providerOptions.openai.include = ["reasoning.encrypted_content"];
  }

  const tools: ToolSet = {};
  const transformedMessages = transformMessages(messages, userId);

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
  return messages.map((message): ModelMessage => {
    if (message.role === "assistant") return { role: "assistant", content: message.content };

    const parts = message.attachments
      ? message.attachments.map((attachment): Exclude<UserContent[number], string> => {
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
        })
      : [];

    return {
      role: "user",
      content:
        parts.length === 0 ? message.content : [{ type: "text", text: message.content }, ...parts],
    };
  });
}
