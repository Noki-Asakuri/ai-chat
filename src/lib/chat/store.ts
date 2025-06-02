import type { Id } from "@/convex/_generated/dataModel";

import { v4 as uuid } from "uuid";
import { create } from "zustand";

import type { ChatMessage } from "../types";

export interface ChatState {
  messages: ChatMessage[];
  status: "pending" | "complete" | "streaming" | "error" | undefined;
  threadId: string;
  isResuming: boolean;

  threads: { _id: Id<"threads">; threadId: string; title: string }[];

  assistantMessage?: { id: string; content: string; reasoning: string };

  chatInput: string;
  setChatInput: (input: string) => void;

  scrollToBottom: boolean;
  setScrollToBottom: (scrollToBottom: boolean) => void;

  newThreadId: string;
  rotateNewThreadId: () => void;

  setAssistantMessage: (message: { id: string; content: string; reasoning: string }) => void;
  setIsResuming: (isResuming: boolean) => void;

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

  isResuming: false,
  threads: [],

  newThreadId: uuid(),
  rotateNewThreadId: () => set({ newThreadId: uuid() }),

  chatInput: "",
  setChatInput: (input) => set({ chatInput: input }),

  scrollToBottom: false,
  setScrollToBottom: (scrollToBottom) => set({ scrollToBottom }),

  setAssistantMessage: (message) => set({ assistantMessage: message }),
  setIsResuming: (isResuming) => set({ isResuming }),

  setMessages: (messages) => set({ messages }),
  setDataFromConvex: (messages, status, threadId) => set({ messages, status, threadId }),
  setThreads: (threads) => set({ threads }),

  setThreadId: (threadId) => set({ threadId }),
  setStatus: (status) => set({ status }),
}));

export const chatStore = useChatStore;
