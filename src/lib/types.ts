import type { Doc, Id } from "@/convex/_generated/dataModel";

export type Thread = {
  _id: Id<"threads">;
  title: string;
  updatedAt: number;
  pinned: boolean;
  branchedFrom?: Id<"threads">;
};

export type ReasoningEffort = "low" | "medium" | "high";
export type ThinkingBudget = number;

export type ChatRequest = {
  threadId: Id<"threads">;
  assistantMessageId: Id<"messages">;
  messages: Omit<InputMessage, "messageId">[];
  config: {
    temperature: number;
    topP: number;
    topK: number;
    maxTokens: number;
    presencePenalty: number;
    frequencyPenalty: number;

    webSearch: boolean;
    reasoningEffort: ReasoningEffort;
    thinkingBudget: ThinkingBudget;
    model: string;
  };
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

export type ChatMessage = Omit<Doc<"messages">, "attachments"> & {
  attachments: Doc<"attachments">[];
};
