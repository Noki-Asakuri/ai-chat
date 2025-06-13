import type { Id } from "@/convex/_generated/dataModel";

import { z } from "zod/v4";

import type { GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import type { OpenAIResponsesProviderOptions } from "@ai-sdk/openai";
import type { ModelMessage } from "ai";

import { AllModelIds } from "../chat/models";

const inputSchema = z.object({
  messages: z.array(
    z.object({
      id: z.string(),
      role: z.enum(["assistant", "user"]),
      content: z.string(),
      attachments: z.string().array().optional(),
    }),
  ),
  assistantMessageId: z.custom<Id<"messages">>((data) => z.string().parse(data)),
  threadId: z.custom<Id<"threads">>((data) => z.string().parse(data)),
  config: z
    .object({
      webSearch: z.boolean(),
      reasoning: z.union([
        z.number().min(0).max(32_768),
        z.enum(["low", "medium", "high"]),
        z.literal(false),
      ]),
      model: z.string(),
    })
    .partial(),
});

const modelValidator = z
  .enum(AllModelIds)
  .default("google/gemini-2.5-flash-preview-05-20")
  .catch("google/gemini-2.5-flash-preview-05-20");

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
  const model = modelValidator.parse(config?.model);

  const providerOptions = {
    google: { safetySettings } as GoogleGenerativeAIProviderOptions,
    openai: {} as OpenAIResponsesProviderOptions,
  };

  if (config?.reasoning) {
    if (typeof config.reasoning === "number") {
      providerOptions.google.thinkingConfig = {
        includeThoughts: true,
        thinkingBudget: config.reasoning,
      };
    }

    if (typeof config.reasoning === "string") {
      providerOptions.openai = { reasoningEffort: config.reasoning };
    }
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
    model,
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

    const attachmentUrls = message.attachments
      ? message.attachments.map((attachment) => {
          return `https://files.chat.asakuri.me/${userId}/${threadId}/${attachment}`;
        })
      : [];

    return {
      role: "user",
      content:
        attachmentUrls.length === 0
          ? message.content
          : [
              { type: "text", text: message.content },
              ...attachmentUrls.map((url) => ({ type: "image" as const, image: url })),
            ],
    };
  });
}
