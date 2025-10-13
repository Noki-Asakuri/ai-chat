import type { Doc } from "@/convex/_generated/dataModel";
import type { ChatRequestBody } from "@/lib/server/validate-request-body";

type Thread = Doc<"threads">;

type ReasoningEffort = "low" | "medium" | "high";
type ThinkingBudget = number;

type InputMessage = {
  messageId: string;
  content: string;
  role: "assistant" | "user" | "system";
};

type UserAttachment = {
  id: string;
  name: string;
  size: number;
  file: File;
  type: "image" | "pdf";
  mimeType: string;
};

type ChatMessage = Omit<Doc<"messages">, "attachments"> & {
  attachments: Doc<"attachments">[];
};

export type {
  ChatMessage,
  ChatRequestBody,
  InputMessage,
  ReasoningEffort,
  ThinkingBudget,
  Thread,
  UserAttachment,
};
