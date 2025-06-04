import type { Id } from "@/convex/_generated/dataModel";

export type ChatRequest = {
  threadId: Id<"threads">;
  assistantMessageId: Id<"messages">;
  messages: Omit<InputMessage, "messageId">[];
  config?: { webSearch: boolean; reasoning: boolean; model: string };
};

export type InputMessage = {
  messageId: string;
  content: string;
  role: "assistant" | "user" | "system";
};

export type ChatMessage = {
  _id: Id<"messages">;
  threadId: Id<"threads">;
  messageId: string;
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

  metadata?: {
    duration: number;
    finishReason: string;
    totalTokens: number;
    thinkingTokens: number;
  };
};
