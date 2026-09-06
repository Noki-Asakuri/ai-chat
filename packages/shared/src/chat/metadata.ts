import { z } from "zod/v4";

import type { UIMessage } from "./ui";

export const reasoningEffortValues = ["none", "minimal", "low", "medium", "high", "xhigh", "max"] as const;

export const reasoningEffortSchema = z.enum(reasoningEffortValues);

export type ReasoningEffort = z.infer<typeof reasoningEffortSchema>;

export const metadataSchema = z
  .object({
    model: z.object({ request: z.string(), response: z.nullable(z.string()) }),
    finishReason: z.nullable(z.string()),
    timeToFirstTokenMs: z.number(),
    durations: z.object({ request: z.number(), reasoning: z.number(), text: z.number() }),
    usages: z.object({
      inputTokens: z.number(),
      outputTokens: z.number(),
      reasoningTokens: z.number(),
      totalOutputTokens: z.number().optional(),
      inputReported: z.boolean().optional(),
      outputReported: z.boolean().optional(),
    }),
    modelParams: z.object({
      webSearch: z.boolean(),
      effort: reasoningEffortSchema,
      profile: z.string().nullish(),
    }),
  })
  .optional();

export type Metadata = z.infer<typeof metadataSchema>;
export type UIChatMessage = UIMessage<Metadata>;
