import type { Doc, Id } from "@/convex/_generated/dataModel";

import { z } from "zod";
import { create } from "zustand";

import { profileIdSchema } from "../server/validate-request-body";
import type { ChatMessage, ReasoningEffort, Thread, UserAttachment } from "../types";
import { getModelData } from "./models";

type PreviewImage = {
  src: string;
  mediaType: string;
  name?: string;
  size?: number;
};

type ChatConfig = {
  model: string;
  effort: ReasoningEffort;
  webSearch: boolean;
  profile?: { id: Id<"profiles">; name: string; systemPrompt: string } | null;
};

const DEFAULT_CONFIG: ChatConfig = {
  webSearch: false,
  effort: "medium",
  model: "openai/gpt-5-nano",
  profile: null,
} as const;

const PROFILE_LOCAL_STORAGE_KEY = "local-profiles-cache";

function getChatConfigFromLS() {
  if (typeof window === "undefined" || window.localStorage === undefined) {
    return DEFAULT_CONFIG;
  }

  const config = window.localStorage.getItem("chatConfig");
  if (!config) return DEFAULT_CONFIG;

  const schema = z.object({
    model: z.string().catch(DEFAULT_CONFIG.model),
    webSearch: z.boolean().catch(DEFAULT_CONFIG.webSearch),
    effort: z.enum(["minimal", "none", "low", "medium", "high"]).catch(DEFAULT_CONFIG.effort),
    profile: z
      .object({ id: profileIdSchema, name: z.string(), systemPrompt: z.string() })
      .nullish()
      .catch(null),
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

  userCustomization: NonNullable<Doc<"users">["customization"]> | null;
  setUserCustomization: (customization: NonNullable<Doc<"users">["customization"]> | null) => void;

  attachments: UserAttachment[];
  setAttachment: (attachments: UserAttachment[]) => void;
  addAttachment: (attachments: UserAttachment[]) => void;
  removeAttachment: (attachmentId: string) => void;

  editMessage: { _id: Id<"messages">; content: string } | null;
  setEditMessage: (message: { _id: Id<"messages">; content: string } | null) => void;

  isDragOver: boolean;
  setIsDragOver: (isDragOver: boolean) => void;

  popupRetryMessageId: string;
  setPopupRetryMessageId: (messageId: string) => void;

  assistantMessages: Record<
    string,
    {
      id: string;
      parts: ChatMessage["parts"];
      metadata: ChatMessage["metadata"];
    }
  >;
  setAssistantMessage: (message: {
    id: string | Id<"messages">;
    parts: ChatMessage["parts"];
    metadata?: ChatMessage["metadata"];
  }) => void;
  clearAssistantMessage: (assistantMessageId: string | Id<"messages">) => void;
  clearAssistantMessages: () => void;

  // Client-side early image previews during streaming
  previewImages: Record<string, Array<PreviewImage>>;
  addPreviewImage: (messageId: string, image: PreviewImage) => void;
  clearPreviewImages: (messageId: string) => void;

  chatConfig: ReturnType<typeof getChatConfigFromLS>;
  setChatConfig: (config: Partial<ReturnType<typeof getChatConfigFromLS>>) => void;

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

  activeDraggingItem:
    | { type: "thread"; item: Doc<"threads"> }
    | { type: "group"; item: Doc<"groups"> }
    | null;
  setActiveDraggingItem: (
    item: { type: "thread"; item: Doc<"threads"> } | { type: "group"; item: Doc<"groups"> } | null,
  ) => void;

  activeStreams: string[];
  markStreamStart: (assistantMessageId: string | Id<"messages">) => void;
  markStreamEnd: (assistantMessageId: string | Id<"messages">) => void;
  hasActiveStream: (assistantMessageId: string | Id<"messages">) => boolean;

  controllers: Record<string, AbortController>;
  setController: (assistantMessageId: string | Id<"messages">, controller: AbortController) => void;
  clearController: (assistantMessageId: string | Id<"messages">) => void;
  getController: (assistantMessageId: string | Id<"messages">) => AbortController | undefined;

  profiles: Doc<"profiles">[];
  setProfiles: (profiles: Doc<"profiles">[]) => void;

  resetState: () => void;
  setDataFromConvex: (
    messages: ChatMessage[],
    status: "pending" | "complete" | "streaming" | "error" | undefined,
  ) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  setMessages: (messages) => set({ messages }),

  userCustomization: null,
  setUserCustomization: (customization) => set({ userCustomization: customization }),

  attachments: [],
  setAttachment: (attachments) => set({ attachments }),
  addAttachment: (attachments) =>
    set((state) => ({ attachments: [...state.attachments, ...attachments] })),
  removeAttachment: (attachmentId) =>
    set((state) => ({ attachments: state.attachments.filter((a) => a.id !== attachmentId) })),

  assistantMessages: {},
  setAssistantMessage: (message) =>
    set((state) => {
      const id = message.id;
      const prev = state.assistantMessages[id] ?? { id, parts: [], metadata: undefined };

      return {
        assistantMessages: { ...state.assistantMessages, [id]: { ...prev, ...message, id } },
      };
    }),
  clearAssistantMessage: (assistantMessageId) =>
    set((state) => {
      const next = { ...state.assistantMessages };
      delete next[assistantMessageId];

      return { assistantMessages: next };
    }),
  clearAssistantMessages: () => set({ assistantMessages: {} }),

  // Previews
  previewImages: {},
  addPreviewImage: (messageId, image) =>
    set((state) => {
      const list = state.previewImages[messageId] ?? [];
      return { previewImages: { ...state.previewImages, [messageId]: [...list, image] } };
    }),
  clearPreviewImages: (messageId) =>
    set((state) => {
      const previews = { ...state.previewImages };
      delete previews[messageId];
      return { previewImages: previews };
    }),

  popupRetryMessageId: "",
  setPopupRetryMessageId: (messageId) => set({ popupRetryMessageId: messageId }),

  threads: [],
  setThreads: (threads) => set({ threads }),

  activeDraggingItem: null,
  setActiveDraggingItem: (item) => set({ activeDraggingItem: item }),

  threadCommandOpen: false,
  setThreadCommandOpen: (open) =>
    set((state) => ({
      threadCommandOpen: typeof open === "function" ? open(state.threadCommandOpen) : open,
    })),

  activeStreams: [],
  hasActiveStream: (assistantMessageId) => get().activeStreams.includes(assistantMessageId),

  markStreamStart: (assistantMessageId) =>
    set((state) => {
      if (state.activeStreams.includes(assistantMessageId)) {
        return state;
      }
      return { activeStreams: [...state.activeStreams, assistantMessageId] };
    }),
  markStreamEnd: (assistantMessageId) =>
    set((state) => ({
      activeStreams: state.activeStreams.filter((id) => id !== assistantMessageId),
    })),

  controllers: {},
  getController: (assistantMessageId) => get().controllers[assistantMessageId],

  setController: (assistantMessageId, controller) =>
    set((state) => ({
      controllers: { ...state.controllers, [assistantMessageId]: controller },
    })),
  clearController: (assistantMessageId) =>
    set((state) => {
      const next = { ...state.controllers };
      delete next[assistantMessageId];
      return { controllers: next };
    }),

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

  chatInput: getInitialChatInput(),
  setChatInput: (input) => {
    const value = typeof input === "function" ? input(getInitialChatInput()) : input;
    window.localStorage.setItem("chatInput", value);
    set({ chatInput: value });
  },

  scrollPosition: null,
  setScrollPosition: (value) => set({ scrollPosition: value }),

  // Default: 147px + 8px (positon bottom) + 16px (padding above)
  textareaHeight: 147 + 8 + 16,
  setTextareaHeight: (height) => set({ textareaHeight: Math.max(height, 147) + 8 + 16 }),

  lastUserMessageHeight: null,
  setMessageHeight: (height) => set({ lastUserMessageHeight: height }),

  profiles: [],
  setProfiles: (profiles) =>
    set(() => {
      localStorage.setItem(PROFILE_LOCAL_STORAGE_KEY, JSON.stringify(profiles));
      return { profiles };
    }),

  setDataFromConvex: (messages, status) =>
    set((state) => {
      const previews = { ...state.previewImages };

      for (const m of messages) {
        const key = m._id as string;
        if (!!previews[key]?.length && !!m.attachments?.length) {
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
      assistantMessages: {},
    })),
}));

export const chatStore = useChatStore;
