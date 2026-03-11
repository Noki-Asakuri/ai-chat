import type { Doc } from "@ai-chat/backend/convex/_generated/dataModel";

import type { ChatRequestBody } from "@ai-chat/shared/chat/request";
import {
  metadataSchema,
  type ReasoningEffort,
  type UIChatMessage,
} from "@ai-chat/shared/chat/metadata";

type Thread = Doc<"threads">;

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

export { metadataSchema };
