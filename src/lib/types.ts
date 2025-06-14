import type { Doc, Id } from "@/convex/_generated/dataModel";

export type Thread = {
  _id: Id<"threads">;
  title: string;
  updatedAt: number;
  pinned: boolean;
  branchedFrom?: Id<"threads">;
};

export type ReasoningEffort = "low" | "medium" | "high" | number | false;

export type ChatRequest = {
  threadId: Id<"threads">;
  assistantMessageId: Id<"messages">;
  messages: Omit<InputMessage, "messageId">[];
  config: { webSearch: boolean; reasoning: ReasoningEffort; model: string };
};

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
};

export type ChatMessage = {
  _id: Id<"messages">;
  threadId: Id<"threads">;
  messageId: string;
  userId: string;
  content: string;
  reasoning?: string;
  sources?: { id: string; title?: string; url: string }[];
  error?: string;
  role: "assistant" | "user" | "system";
  status: "pending" | "complete" | "streaming" | "error";
  model: string;
  resumableStreamId?: string | null;
  createdAt: number;
  updatedAt: number;

  _creationTime: number;

  attachments?: Doc<"attachments">[];

  metadata?: {
    duration: number;
    finishReason: string;
    totalTokens: number;
    thinkingTokens: number;
  };
};
