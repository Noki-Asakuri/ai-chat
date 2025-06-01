import type { Id } from "@/convex/_generated/dataModel";

export type ChatRequest = {
  threadId: string;
  _threadId?: Id<"threads">;
  assistantMessageId: string;
  messages: Omit<InputMessage, "messageId">[];
};

export type InputMessage = {
  messageId: string;
  content: string;
  role: "assistant" | "user" | "system";
};

export type ChatMessage = {
  _id: Id<"messages">;
  threadId: string;
  messageId: string;
  content: string;
  reasoning?: string;
  role: "assistant" | "user" | "system";
  status: "pending" | "complete" | "streaming" | "error";
  model: string;
  resumableStreamId?: string | null;
  createdAt: number;
  updatedAt: number;

  metadata?: {
    duration: number;
    finishReason: string;
    totalTokens: number;
    thinkingTokens: number;
  };
};
