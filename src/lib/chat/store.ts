import { create } from "zustand";
import type { ChatMessage } from "../types";

export interface ChatState {
  messages: ChatMessage[];
  status: "pending" | "complete" | "streaming" | "error" | undefined;
  threadId: string;
  localStreaming: boolean;
  isResuming: boolean;

  assistantMessage?: { id: string; content: string; reasoning: string };

  setAssistantMessage: (message: { id: string; content: string; reasoning: string }) => void;
  setLocalStreaming: (localStreaming: boolean) => void;
  setIsResuming: (isResuming: boolean) => void;

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
  isResuming: false,

  setAssistantMessage: (message) => set({ assistantMessage: message }),
  setLocalStreaming: (localStreaming) => set({ localStreaming }),
  setIsResuming: (isResuming) => set({ isResuming }),

  setDataFromConvex: (messages, status, threadId) => set({ messages, status, threadId }),
  setThreadId: (threadId) => set({ threadId }),
  setStatus: (status) => set({ status }),
}));

export const chatStore = useChatStore;
