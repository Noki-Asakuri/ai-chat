import type { Doc } from "@/convex/_generated/dataModel";

import type { UIDataTypes, UIMessage, UITools } from "ai";
import { z } from "zod/v4";

import type { ChatRequestBody } from "@/lib/server/validate-request-body";

type Thread = Doc<"threads">;

type ReasoningEffort = NonNullable<Doc<"messages">["metadata"]>["modelParams"]["effort"];

type UserAttachment = { id: string; file: File; type: "image" | "pdf" };

type ChatMessage = Omit<Doc<"messages">, "attachments"> & {
  attachments: Doc<"attachments">[];
};

type RemoveFunctions<T> = {
  [K in keyof T as T[K] extends Function ? never : K]: T[K];
};

type RemoveAllExceptFunctions<T> = {
  [K in keyof T as T[K] extends Function ? K : never]: T[K];
};

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
    }),

    modelParams: z.object({
      webSearch: z.boolean(),
      effort: z.string(),
      profile: z.string().nullish(),
    }),
  })
  .optional();

type Metadata = z.infer<typeof metadataSchema>;

type UIChatMessage = UIMessage<Metadata, UIDataTypes, UITools>;

export type {
  ChatMessage,
  ChatRequestBody,
  ReasoningEffort,
  Thread,
  UIChatMessage,
  UserAttachment,
  RemoveFunctions,
  RemoveAllExceptFunctions,
};
