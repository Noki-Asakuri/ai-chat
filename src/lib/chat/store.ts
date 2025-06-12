import type { Id } from "@/convex/_generated/dataModel";

import { create } from "zustand";

import type { UserAttachment, ChatMessage, Thread } from "../types";

export interface ChatState {
  messages: ChatMessage[];
  setMessages: (messages: ChatMessage[]) => void;

  attachments: UserAttachment[];
  setAttachment: (attachments: UserAttachment[]) => void;
  addAttachment: (attachments: UserAttachment[]) => void;

  status: "pending" | "complete" | "streaming" | "error" | undefined;
  setStatus: (status: "pending" | "complete" | "streaming" | "error") => void;
  removeAttachment: (attachmentId: string) => void;

  threadId?: Id<"threads">;
  setThreadId: (threadId?: Id<"threads">) => void;

  editMessage: { _id: Id<"messages">; content: string } | null;
  setEditMessage: (message: { _id: Id<"messages">; content: string } | null) => void;

  isStreaming: boolean;
  setIsStreaming: (isResuming: boolean) => void;

  assistantMessage: {
    id: string;
    content: string;
    reasoning: string;
    metadata: ChatMessage["metadata"];
  };
  setAssistantMessage: (
    message: Partial<{
      id: string;
      content: string;
      reasoning: string;
      metadata: ChatMessage["metadata"];
    }>,
  ) => void;

  chatConfig: { webSearch: boolean; reasoning: boolean; model: string };
  setChatConfig: (
    config: Partial<{ webSearch: boolean; reasoning: boolean; model: string }>,
  ) => void;

  abortController: AbortController;
  setAbortController: (controller: AbortController) => void;

  chatInput: string;
  setChatInput: (input: string) => void;

  wrapline: boolean;
  toggleWrapline: () => void;

  scrollPosition: "top" | "bottom" | "middle" | null;
  setScrollPosition: (value: "top" | "bottom" | "middle" | null) => void;

  textareaHeight: number;
  setTextareaHeight: (height: number) => void;

  threads: Thread[];
  setThreads: (threads: Thread[]) => void;

  threadCommandOpen: boolean;
  setThreadCommandOpen: (open: boolean | ((open: boolean) => boolean)) => void;

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

  attachments: [],
  setAttachment: (attachments) => set({ attachments }),
  addAttachment: (attachments) =>
    set((state) => ({ attachments: [...state.attachments, ...attachments] })),
  removeAttachment: (attachmentId) =>
    set((state) => ({ attachments: state.attachments.filter((a) => a.id !== attachmentId) })),

  status: undefined,
  setStatus: (status) => set({ status }),

  assistantMessage: { id: "", content: "", reasoning: "", metadata: undefined },
  setAssistantMessage: (message) =>
    set((state) => ({ assistantMessage: { ...state.assistantMessage, ...message } })),

  threadId: undefined,
  setThreadId: (threadId) => set({ threadId }),

  isStreaming: false,
  setIsStreaming: (isStreaming) => set({ isStreaming }),

  threads: [],
  setThreads: (threads) => set({ threads }),

  threadCommandOpen: false,
  setThreadCommandOpen: (open) =>
    set((state) => ({
      threadCommandOpen: typeof open === "function" ? open(state.threadCommandOpen) : open,
    })),

  chatConfig: {
    webSearch: getItemFromLocalStorage("webSearch", "false") === "true",
    reasoning: getItemFromLocalStorage("reasoning", "false") === "true",
    model: getItemFromLocalStorage("model", "google/gemini-2.5-flash-preview-05-20"),
  },
  setChatConfig: (config) =>
    set((state) => {
      localStorage.setItem("webSearch", String(config.webSearch ?? state.chatConfig.webSearch));
      localStorage.setItem("reasoning", String(config.reasoning ?? state.chatConfig.reasoning));
      localStorage.setItem(
        "model",
        config.model ?? state.chatConfig.model ?? "google/gemini-2.5-flash-preview-05-20",
      );

      return { chatConfig: { ...state.chatConfig, ...config } };
    }),

  wrapline:
    typeof window === "undefined" ? false : window.localStorage?.getItem("wrapline") === "true",
  toggleWrapline: () =>
    set((state) => {
      localStorage.setItem("wrapline", state.wrapline ? "false" : "true");
      return { wrapline: !state.wrapline };
    }),

  editMessage: null,
  setEditMessage: (editMessage) => set({ editMessage }),

  abortController: new AbortController(),
  setAbortController: (abortController) => set({ abortController }),

  chatInput: "",
  setChatInput: (input) => set({ chatInput: input }),

  scrollPosition: null,
  setScrollPosition: (value) => set({ scrollPosition: value }),

  textareaHeight: 140,
  setTextareaHeight: (height) => set({ textareaHeight: Math.max(height, 140) }),

  setDataFromConvex: (messages, status, threadId) => set({ messages, status, threadId }),
  resetState: () =>
    set(() => ({
      messages: [],
      status: "complete",
      isStreaming: false,
      editMessageId: null,
      scrollPosition: null,
    })),
}));

export const chatStore = useChatStore;
