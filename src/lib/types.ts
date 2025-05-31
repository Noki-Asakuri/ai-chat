export type ChatRequest = {
  threadId: string;
  assistantMessageId: string;
  messages: Omit<Message, "messageId">[];
};

export type Message = {
  messageId: string;
  content: string;
  role: "assistant" | "user" | "system";
};
