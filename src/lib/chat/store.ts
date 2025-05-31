import { create } from "zustand";
import type { ChatMessage } from "../types";

interface ChatState {
  messages: ChatMessage[];
  status: "pending" | "complete" | "streaming" | "error" | undefined;
  threadId: string;
  localStreaming: boolean;

  assistantMessage?: { id: string; content: string; reasoning: string };

  setAssistantMessage: (message: { id: string; content: string; reasoning: string }) => void;

  setDataFromConvex: (
    messages: ChatMessage[],
    status: "pending" | "complete" | "streaming" | "error" | undefined,
    threadId: string,
  ) => void;

  setThreadId: (threadId: string) => void;
  setStatus: (status: "pending" | "complete" | "streaming" | "error") => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  status: undefined,
  assistantMessage: undefined,
  threadId: "",
  localStreaming: false,

  setAssistantMessage: (message) => set({ assistantMessage: message }),

  setDataFromConvex: (messages, status, threadId) => set({ messages, status, threadId }),
  setThreadId: (threadId) => set({ threadId }),
  setStatus: (status) => set({ status }),
}));

export const chatStore = useChatStore;
