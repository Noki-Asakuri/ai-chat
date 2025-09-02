import type { Id } from "@/convex/_generated/dataModel";

import { z } from "zod";
import { create } from "zustand";

import type { ChatMessage, Thread, UserAttachment } from "../types";
import { getModelData } from "./models";

type PreviewImage = {
  src: string;
  mediaType: string;
  name?: string;
  size?: number;
};

const DEFAULT_CONFIG = {
  webSearch: false,
  reasoningEffort: "medium",
  model: "openai/gpt-5-nano",
  profile: { id: null, systemPrompt: "" },
} as const;

function getChatConfigFromLS() {
  if (typeof window === "undefined" || window.localStorage === undefined) {
    return DEFAULT_CONFIG;
  }

  const config = window.localStorage.getItem("chatConfig");
  if (!config) return DEFAULT_CONFIG;

  const schema = z.object({
    model: z.string().catch(DEFAULT_CONFIG.model),
    webSearch: z.boolean().catch(DEFAULT_CONFIG.webSearch),
    reasoningEffort: z.enum(["low", "medium", "high"]).catch(DEFAULT_CONFIG.reasoningEffort),

    profile: z
      .object({ id: z.string().nullable(), systemPrompt: z.string() })
      .catch(DEFAULT_CONFIG.profile),
  });

  try {
    return schema.parse(JSON.parse(config));
  } catch {
    return DEFAULT_CONFIG;
  }
}

function getInitialChatInput() {
  return window.localStorage.getItem("chatInput") ?? "";
}

export interface ChatState {
  messages: ChatMessage[];
  setMessages: (messages: ChatMessage[]) => void;

  attachments: UserAttachment[];
  setAttachment: (attachments: UserAttachment[]) => void;
  addAttachment: (attachments: UserAttachment[]) => void;

  status: "pending" | "complete" | "streaming" | "error" | undefined;
  setStatus: (status: "pending" | "complete" | "streaming" | "error") => void;
  removeAttachment: (attachmentId: string) => void;

  editMessage: { _id: Id<"messages">; content: string } | null;
  setEditMessage: (message: { _id: Id<"messages">; content: string } | null) => void;

  isDragOver: boolean;
  setIsDragOver: (isDragOver: boolean) => void;

  isStreaming: boolean;
  setIsStreaming: (isResuming: boolean) => void;

  popupRetryMessageId: string;
  setPopupRetryMessageId: (messageId: string) => void;

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

  // Client-side early image previews during streaming
  previewImages: Record<string, Array<PreviewImage>>;
  addPreviewImage: (messageId: string, image: PreviewImage) => void;
  clearPreviewImages: (messageId: string) => void;

  chatConfig: ReturnType<typeof getChatConfigFromLS>;
  setChatConfig: (config: Partial<ReturnType<typeof getChatConfigFromLS>>) => void;

  abortController: AbortController;
  setAbortController: (controller: AbortController) => void;

  chatInput: string;
  setChatInput: (input: string | ((prev: string) => string)) => void;

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

  lastUserMessageHeight?: number | null;
  setMessageHeight: (height?: number | null) => void;

  resetState: () => void;
  setDataFromConvex: (
    messages: ChatMessage[],
    status: "pending" | "complete" | "streaming" | "error" | undefined,
  ) => void;
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

  // Previews
  previewImages: {},
  addPreviewImage: (messageId, image) =>
    set((state) => {
      const key = String(messageId);
      const list = state.previewImages[key] ?? [];
      return { previewImages: { ...state.previewImages, [key]: [...list, image] } };
    }),
  clearPreviewImages: (messageId) =>
    set((state) => {
      const previews = { ...state.previewImages };
      delete previews[String(messageId)];
      return { previewImages: previews };
    }),

  isStreaming: false,
  setIsStreaming: (isStreaming) => set({ isStreaming }),

  popupRetryMessageId: "",
  setPopupRetryMessageId: (messageId) => set({ popupRetryMessageId: messageId }),

  threads: [],
  setThreads: (threads) => set({ threads }),

  threadCommandOpen: false,
  setThreadCommandOpen: (open) =>
    set((state) => ({
      threadCommandOpen: typeof open === "function" ? open(state.threadCommandOpen) : open,
    })),

  chatConfig: getChatConfigFromLS(),
  setChatConfig: (config) =>
    set((state) => {
      const newConfig = { ...state.chatConfig, ...config };
      const model = getModelData(newConfig.model);

      if (config.model) {
        if (!model.capabilities.webSearch) newConfig.webSearch = false;
      }

      localStorage.setItem("chatConfig", JSON.stringify(newConfig));
      return { chatConfig: newConfig };
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

  isDragOver: false,
  setIsDragOver: (isDragOver) => set({ isDragOver }),

  abortController: new AbortController(),
  setAbortController: (abortController) => set({ abortController }),

  chatInput: getInitialChatInput(),
  setChatInput: (input) => {
    const value = typeof input === "function" ? input(getInitialChatInput()) : input;
    window.localStorage.setItem("chatInput", value);
    set({ chatInput: value });
  },

  scrollPosition: null,
  setScrollPosition: (value) => set({ scrollPosition: value }),

  // Default: 187px + 8px (positon bottom) + 16px (padding above)
  textareaHeight: 187 + 8 + 16,
  setTextareaHeight: (height) => set({ textareaHeight: Math.max(height, 187) + 8 + 16 }),

  lastUserMessageHeight: null,
  setMessageHeight: (height) => set({ lastUserMessageHeight: height }),

  setDataFromConvex: (messages, status) =>
    set((state) => {
      const previews = { ...state.previewImages };
      for (const m of messages) {
        const key = String(m._id);
        if ((previews[key]?.length ?? 0) > 0 && (m.attachments?.length ?? 0) > 0) {
          delete previews[key];
        }
      }
      return { messages, status, previewImages: previews };
    }),
  resetState: () =>
    set(() => ({
      messages: [],
      status: "complete",
      isStreaming: false,
      editMessageId: null,
      scrollPosition: null,
      messageHeights: {},
      lastUserMessageId: null,
      lastUserMessageHeight: null,
      previewImages: {},
    })),
}));

export const chatStore = useChatStore;
