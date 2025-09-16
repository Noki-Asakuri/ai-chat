import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { RequestBody } from "@/lib/server/validate-request-body";

export type Thread = Doc<"threads">;

export type ReasoningEffort = "low" | "medium" | "high";
export type ThinkingBudget = number;

export type { RequestBody };

export type ChatRequest = RequestBody;

export type InputMessage = {
  messageId: string;
  content: string;
  role: "assistant" | "user" | "system";
};

export type UserAttachment = {
  id: string;
  name: string;
  size: number;
  file: File;
  type: "image" | "pdf";
  mimeType: string;
};

export type ChatMessage = Omit<Doc<"messages">, "attachments"> & {
  attachments: Doc<"attachments">[];
};
