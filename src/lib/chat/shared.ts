import type { ChatMessage, UIChatMessage } from "../types";

export function convertToUIChatMessages(messages: ChatMessage[]): UIChatMessage[] {
  return messages.map(
    (message): UIChatMessage => ({
      id: message.messageId,
      role: message.role,
      parts: message.parts as UIChatMessage["parts"],
      metadata: message.metadata,
    }),
  );
}
