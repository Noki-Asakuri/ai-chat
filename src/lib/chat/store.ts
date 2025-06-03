import type { Id } from "@/convex/_generated/dataModel";

import { v4 as uuid } from "uuid";
import { create } from "zustand";

import type { ChatMessage } from "../types";

export interface ChatState {
  messages: ChatMessage[];
  status: "pending" | "complete" | "streaming" | "error" | undefined;
  threadId: string;

  editMessageId: string | null;
  setEditMessageId: (messageId: string | null) => void;

  isStreaming: boolean;

  threads: { _id: Id<"threads">; threadId: string; title: string }[];

  assistantMessage?: { id: string; content: string; reasoning: string };

  chatConfig: { webSearch: boolean; reasoning: boolean; model: string };
  setChatConfig: (config: Partial<{ webSearch: boolean; reasoning: boolean; model: string }>) => void;

  abortController?: AbortController;
  setAbortController: (controller?: AbortController) => void;

  chatInput: string;
  setChatInput: (input: string) => void;

  isAtBottom: boolean;
  setAtBottom: (value: boolean) => void;

  newThreadId: string;
  rotateNewThreadId: () => void;

  setAssistantMessage: (message: { id: string; content: string; reasoning: string }) => void;
  setIsStreaming: (isResuming: boolean) => void;

  setDataFromConvex: (
    messages: ChatMessage[],
    status: "pending" | "complete" | "streaming" | "error" | undefined,
    threadId: string,
  ) => void;

  setMessages: (messages: ChatMessage[]) => void;
  setThreads: (threads: { _id: Id<"threads">; threadId: string; title: string }[]) => void;

  setThreadId: (threadId: string) => void;
  setStatus: (status: "pending" | "complete" | "streaming" | "error") => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  status: undefined,
  assistantMessage: undefined,
  threadId: "",

  isStreaming: false,
  threads: [],
  chatConfig: {
    webSearch: typeof window === "undefined" ? false : window.localStorage?.getItem("webSearch") === "true",
    reasoning: typeof window === "undefined" ? false : window.localStorage?.getItem("reasoning") === "true",
    model: "google/gemini-2.5-flash-preview-05-20",
  },
  setChatConfig: (config) =>
    set((state) => {
      localStorage.setItem("webSearch", config.webSearch ? "true" : "false");
      localStorage.setItem("reasoning", config.reasoning ? "true" : "false");
      localStorage.setItem("model", config.model ?? "google/gemini-2.5-flash-preview-05-20");

      return { chatConfig: { ...state.chatConfig, ...config } };
    }),

  editMessageId: null,
  setEditMessageId: (messageId) => set({ editMessageId: messageId }),

  abortController: undefined,
  setAbortController: (controller) => set({ abortController: controller }),

  newThreadId: uuid(),
  rotateNewThreadId: () => set({ newThreadId: uuid() }),

  chatInput: "",
  setChatInput: (input) => set({ chatInput: input }),

  isAtBottom: false,
  setAtBottom: (value) => set({ isAtBottom: value }),

  setAssistantMessage: (message) => set({ assistantMessage: message }),
  setIsStreaming: (isStreaming) => set({ isStreaming }),

  setMessages: (messages) => set({ messages }),
  setDataFromConvex: (messages, status, threadId) => set({ messages, status, threadId }),
  setThreads: (threads) => set({ threads }),

  setThreadId: (threadId) => set({ threadId }),
  setStatus: (status) => set({ status }),
}));

export const chatStore = useChatStore;
