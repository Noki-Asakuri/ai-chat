import type { Id } from "@/convex/_generated/dataModel";

import { z } from "zod/v4";

import type { GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import type { OpenAIResponsesProviderOptions } from "@ai-sdk/openai";
import type { ModelMessage, UserContent } from "ai";

import { AllModelIds, getModelData } from "../chat/models";

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
      maxTokens: z.number().min(1024).max(65_536),
      presencePenalty: z.number().min(0).max(1),
      frequencyPenalty: z.number().min(0).max(1),
    })
    .partial(),
});

const modelValidator = z
  .enum(AllModelIds)
  .default("google/gemini-2.5-flash")
  .catch("google/gemini-2.5-flash")
  .transform((model) => {
    return { id: getModelData(model).id, model };
  });

const safetySettings = [
  { threshold: "BLOCK_NONE", category: "HARM_CATEGORY_HARASSMENT" },
  { threshold: "BLOCK_NONE", category: "HARM_CATEGORY_HATE_SPEECH" },
  { threshold: "BLOCK_NONE", category: "HARM_CATEGORY_CIVIC_INTEGRITY" },
  { threshold: "BLOCK_NONE", category: "HARM_CATEGORY_DANGEROUS_CONTENT" },
  { threshold: "BLOCK_NONE", category: "HARM_CATEGORY_SEXUALLY_EXPLICIT" },
];

export async function getRequestBody(req: Request, userId: string) {
  const { success, data, error } = inputSchema.safeParse(await req.json());
  if (!success) {
    throw new Error(z.prettifyError(error));
  }

  const { messages, assistantMessageId, threadId, config } = data;
  const { id, model } = modelValidator.parse(config?.model);

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

    providerOptions.openai = { reasoningEffort: config.reasoningEffort };
  }

  if (config?.webSearch) {
    providerOptions.google.useSearchGrounding = true;
  }

  const transformedMessages = transformMessages(messages, userId, threadId);

  return {
    messages,
    transformedMessages,
    assistantMessageId,
    threadId,
    config,
    model: { id, uniqueId: model },
    providerOptions,
  };
}

function transformMessages(
  messages: z.infer<typeof inputSchema>["messages"],
  userId: string,
  threadId: string,
) {
  return messages.map((message): ModelMessage => {
    if (message.role === "assistant") return { role: "assistant", content: message.content };

    const attachmentParts = message.attachments
      ? message.attachments.map((attachment): Exclude<UserContent[number], string> => {
          const url = `https://files.chat.asakuri.me/${userId}/${threadId}/${attachment._id}`;

          if (attachment.type === "image") {
            return { type: "image" as const, image: url };
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
        attachmentParts.length === 0
          ? message.content
          : [{ type: "text", text: message.content }, ...attachmentParts],
    };
  });
}
