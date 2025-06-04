import type { Id } from "@/convex/_generated/dataModel";

import { create } from "zustand";

import type { ChatMessage } from "../types";

export interface ChatState {
  messages: ChatMessage[];
  setMessages: (messages: ChatMessage[]) => void;

  status: "pending" | "complete" | "streaming" | "error" | undefined;
  setStatus: (status: "pending" | "complete" | "streaming" | "error") => void;

  threadId?: Id<"threads">;
  setThreadId: (threadId?: Id<"threads">) => void;

  editMessageId: string | null;
  setEditMessageId: (messageId: string | null) => void;

  isStreaming: boolean;
  setIsStreaming: (isResuming: boolean) => void;

  assistantMessage: { id: string; content: string; reasoning: string; metadata: ChatMessage["metadata"] };
  setAssistantMessage: (
    message: Partial<{
      id: string;
      content: string;
      reasoning: string;
      metadata: ChatMessage["metadata"];
    }>,
  ) => void;

  chatConfig: { webSearch: boolean; reasoning: boolean; model: string };
  setChatConfig: (config: Partial<{ webSearch: boolean; reasoning: boolean; model: string }>) => void;

  abortController: AbortController;
  setAbortController: (controller: AbortController) => void;

  chatInput: string;
  setChatInput: (input: string) => void;

  wrapline: boolean;
  toggleWrapline: () => void;

  isAtBottom: boolean;
  setAtBottom: (value: boolean) => void;

  textareaHeight: number;
  setTextareaHeight: (height: number) => void;

  threads: { _id: Id<"threads">; title: string }[];
  setThreads: (threads: { _id: Id<"threads">; title: string }[]) => void;

  resetState: () => void;
  setDataFromConvex: (
    messages: ChatMessage[],
    status: "pending" | "complete" | "streaming" | "error" | undefined,
    threadId: Id<"threads">,
  ) => void;
}

function getItemFromLocalStorage<T extends string>(key: string, defaultValue: T) {
  if (typeof window === "undefined" || window.localStorage === undefined) return defaultValue;
  return window.localStorage.getItem(key) ?? defaultValue;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  setMessages: (messages) => set({ messages }),

  status: undefined,
  setStatus: (status) => set({ status }),

  assistantMessage: { id: "", content: "", reasoning: "", metadata: undefined },
  setAssistantMessage: (message) => set((state) => ({ assistantMessage: { ...state.assistantMessage, ...message } })),

  threadId: undefined,
  setThreadId: (threadId) => set({ threadId }),

  isStreaming: false,
  setIsStreaming: (isStreaming) => set({ isStreaming }),

  threads: [],
  setThreads: (threads) => set({ threads }),

  chatConfig: {
    webSearch: getItemFromLocalStorage("webSearch", "false") === "true",
    reasoning: getItemFromLocalStorage("reasoning", "false") === "true",
    model: getItemFromLocalStorage("model", "google/gemini-2.5-flash-preview-05-20"),
  },
  setChatConfig: (config) =>
    set((state) => {
      localStorage.setItem("webSearch", String(config.webSearch));
      localStorage.setItem("reasoning", String(config.reasoning));
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

  abortController: new AbortController(),
  setAbortController: (abortController) => set({ abortController }),

  chatInput: "",
  setChatInput: (input) => set({ chatInput: input }),

  isAtBottom: false,
  setAtBottom: (value) => set({ isAtBottom: value }),

  textareaHeight: 140,
  setTextareaHeight: (height) => set({ textareaHeight: Math.max(height, 140) }),

  setDataFromConvex: (messages, status, threadId) => set({ messages, status, threadId }),
  resetState: () =>
    set(() => ({
      messages: [],
      status: "complete",
      isStreaming: false,
      editMessageId: null,
      isAtBottom: true,
    })),
}));

export const chatStore = useChatStore;
