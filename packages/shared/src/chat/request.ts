import { z } from "zod/v4";

import { reasoningEffortSchema, type ReasoningEffort } from "./metadata";

export const chatModelParamsSchema = z.object({
  webSearch: z.boolean().default(false),
  effort: reasoningEffortSchema.default("medium"),
  profile: z.string().nullish().default(null),
});

export type ChatModelParams<TProfileId = string | null> = {
  webSearch: boolean;
  effort: ReasoningEffort;
  profile?: TProfileId | null;
};

export const chatRequestBodySchema = z.object({
  assistantMessageId: z.string().min(1),
  threadId: z.string().min(1),
  streamId: z.string().min(1).optional(),
  messages: z.unknown().array(),
  model: z.string(),
  modelParams: chatModelParamsSchema,
});

export const safetySettings = [
  { threshold: "BLOCK_NONE", category: "HARM_CATEGORY_HARASSMENT" },
  { threshold: "BLOCK_NONE", category: "HARM_CATEGORY_HATE_SPEECH" },
  { threshold: "BLOCK_NONE", category: "HARM_CATEGORY_CIVIC_INTEGRITY" },
  { threshold: "BLOCK_NONE", category: "HARM_CATEGORY_DANGEROUS_CONTENT" },
  { threshold: "BLOCK_NONE", category: "HARM_CATEGORY_SEXUALLY_EXPLICIT" },
];

export type ChatRequestBody = z.infer<typeof chatRequestBodySchema>;
