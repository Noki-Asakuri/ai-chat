import type { Id } from "@/convex/_generated/dataModel";

import { create } from "zustand";

import type { ChatMessage } from "../types";

export interface ChatState {
  messages: ChatMessage[];
  setMessages: (messages: ChatMessage[]) => void;

  status: "pending" | "complete" | "streaming" | "error" | undefined;
  setStatus: (status: "pending" | "complete" | "streaming" | "error") => void;

  threadId?: Id<"threads"> | null;
  setThreadId: (threadId: Id<"threads">) => void;

  editMessageId: string | null;
  setEditMessageId: (messageId: string | null) => void;

  isStreaming: boolean;
  setIsStreaming: (isResuming: boolean) => void;

  assistantMessage?: { id: string; content: string; reasoning: string };
  setAssistantMessage: (message: { id: string; content: string; reasoning: string }) => void;

  chatConfig: { webSearch: boolean; reasoning: boolean; model: string };
  setChatConfig: (config: Partial<{ webSearch: boolean; reasoning: boolean; model: string }>) => void;

  abortController?: AbortController;
  setAbortController: (controller?: AbortController) => void;

  chatInput: string;
  setChatInput: (input: string) => void;

  wrapline: boolean;
  toggleWrapline: () => void;

  isAtBottom: boolean;
  setAtBottom: (value: boolean) => void;

  textareaHeight: number;
  setTextareaHeight: (height: number) => void;

  setDataFromConvex: (
    messages: ChatMessage[],
    status: "pending" | "complete" | "streaming" | "error" | undefined,
    threadId: Id<"threads">,
  ) => void;

  threads: { _id: Id<"threads">; title: string }[];
  setThreads: (threads: { _id: Id<"threads">; title: string }[]) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  setMessages: (messages) => set({ messages }),

  status: undefined,
  setStatus: (status) => set({ status }),

  assistantMessage: undefined,
  setAssistantMessage: (message) => set({ assistantMessage: message }),

  threadId: null,
  setThreadId: (threadId) => set({ threadId }),

  isStreaming: false,
  setIsStreaming: (isStreaming) => set({ isStreaming }),

  threads: [],
  setThreads: (threads) => set({ threads }),

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

  wrapline: typeof window === "undefined" ? false : window.localStorage?.getItem("wrapline") === "true",
  toggleWrapline: () =>
    set((state) => {
      localStorage.setItem("wrapline", state.wrapline ? "false" : "true");
      return { wrapline: !state.wrapline };
    }),

  editMessageId: null,
  setEditMessageId: (messageId) => set({ editMessageId: messageId }),

  abortController: undefined,
  setAbortController: (controller) => set({ abortController: controller }),

  chatInput: "",
  setChatInput: (input) => set({ chatInput: input }),

  isAtBottom: false,
  setAtBottom: (value) => set({ isAtBottom: value }),

  textareaHeight: 132,
  setTextareaHeight: (height) => set({ textareaHeight: height }),

  setDataFromConvex: (messages, status, threadId) => set({ messages, status, threadId }),
}));

export const chatStore = useChatStore;
