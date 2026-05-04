import type { Doc } from "@ai-chat/backend/convex/_generated/dataModel";

export type UserAttachment = { id: string; file: File; type: "image" | "pdf" };

export type ChatMessage = Omit<Doc<"messages">, "attachments"> & {
  attachments: Doc<"attachments">[];
};

export type ChatMetadata = NonNullable<ChatMessage["metadata"]>;
export type ChatModelParams = NonNullable<ChatMessage["metadata"]>["modelParams"];

export {
  metadataSchema,
  type ReasoningEffort,
  type UIChatMessage,
} from "@ai-chat/shared/chat/metadata";

export type { ChatRequestBody } from "@ai-chat/shared/chat/request";
