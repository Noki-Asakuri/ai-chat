import { z } from "zod/v4";

import { reasoningEffortSchema, type ReasoningEffort } from "./metadata";

export const chatModelParamsSchema = z.object({
  webSearch: z.boolean().default(false),
  effort: reasoningEffortSchema.default("medium"),
  profile: z.string().nullish().default(null),
});

export const chatRequestBodySchema = z.object({
  assistantMessageId: z.string().min(1),
  threadId: z.string().min(1),
  messages: z.unknown().array(),

  model: z.string(),
  modelParams: chatModelParamsSchema,
});

export const safetySettings = [
  { threshold: "BLOCK_NONE", category: "HARM_CATEGORY_HARASSMENT" } as const,
  { threshold: "BLOCK_NONE", category: "HARM_CATEGORY_HATE_SPEECH" } as const,
  { threshold: "BLOCK_NONE", category: "HARM_CATEGORY_CIVIC_INTEGRITY" } as const,
  { threshold: "BLOCK_NONE", category: "HARM_CATEGORY_DANGEROUS_CONTENT" } as const,
  { threshold: "BLOCK_NONE", category: "HARM_CATEGORY_SEXUALLY_EXPLICIT" } as const,
];

export type ChatRequestBody = z.infer<typeof chatRequestBodySchema>;
