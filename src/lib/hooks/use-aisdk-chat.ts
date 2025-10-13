import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

import { type MyUIMessage, metadataSchema } from "../chat/conversion";

export const defaultTransport = new DefaultChatTransport({
  api: "/api/ai/chat",
  credentials: "include",
});

export function useAISDKChat() {
  return useChat<MyUIMessage>({
    transport: defaultTransport,
    messageMetadataSchema: metadataSchema,
  });
}
