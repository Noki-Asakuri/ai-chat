import type { Id } from "@/convex/_generated/dataModel";

import { create } from "zustand";

import type { ChatMessage, UserAttachment } from "../types";

type PreviewImage = {
  src: string;
  mediaType: string;
  name?: string;
  size?: number;
};

export interface ChatState {
  messages: ChatMessage[];
  setMessages: (messages: ChatMessage[]) => void;

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

  assistantMessages: Map<
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

  scrollPosition: "top" | "bottom" | "middle" | null;
  setScrollPosition: (value: "top" | "bottom" | "middle" | null) => void;

  textareaHeight: number;
  setTextareaHeight: (height: number) => void;

  lastUserMessageHeight?: number | null;
  setMessageHeight: (height?: number | null) => void;

  activeStreams: Set<string>;
  markStreamStart: (assistantMessageId: string | Id<"messages">) => void;
  markStreamEnd: (assistantMessageId: string | Id<"messages">) => void;
  hasActiveStream: (assistantMessageId: string | Id<"messages">) => boolean;

  controllers: Map<string, AbortController>;
  setController: (assistantMessageId: string | Id<"messages">, controller: AbortController) => void;
  clearController: (assistantMessageId: string | Id<"messages">) => void;
  getController: (assistantMessageId: string | Id<"messages">) => AbortController | undefined;

  resetState: () => void;
  setDataFromConvex: (
    messages: ChatMessage[],
    status: "pending" | "complete" | "streaming" | "error" | undefined,
  ) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  setMessages: (messages) => set({ messages }),

  attachments: [],
  setAttachment: (attachments) => set({ attachments }),
  addAttachment: (attachments) =>
    set((state) => ({ attachments: [...state.attachments, ...attachments] })),
  removeAttachment: (attachmentId) =>
    set((state) => ({ attachments: state.attachments.filter((a) => a.id !== attachmentId) })),

  assistantMessages: new Map(),
  setAssistantMessage: (message) =>
    set((state) => {
      const id = message.id;
      const prev = state.assistantMessages.get(id) ?? { id, parts: [], metadata: undefined };

      const next = new Map(state.assistantMessages);
      next.set(id, { ...prev, ...message, id });

      return { assistantMessages: next };
    }),
  clearAssistantMessage: (assistantMessageId) =>
    set((state) => {
      const next = new Map(state.assistantMessages);
      next.delete(assistantMessageId);

      return { assistantMessages: next };
    }),
  clearAssistantMessages: () => set({ assistantMessages: new Map() }),

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

  activeStreams: new Set(),
  hasActiveStream: (assistantMessageId) => get().activeStreams.has(assistantMessageId),

  markStreamStart: (assistantMessageId) =>
    set((state) => {
      const next = new Set(state.activeStreams);
      next.add(assistantMessageId);

      return { activeStreams: next };
    }),
  markStreamEnd: (assistantMessageId) =>
    set((state) => {
      const next = new Set(state.activeStreams);
      next.delete(assistantMessageId);

      return { activeStreams: next };
    }),

  controllers: new Map(),
  getController: (assistantMessageId) => get().controllers.get(assistantMessageId),

  setController: (assistantMessageId, controller) =>
    set((state) => {
      const next = new Map(state.controllers);
      next.set(assistantMessageId, controller);

      return { controllers: next };
    }),
  clearController: (assistantMessageId) =>
    set((state) => {
      const next = new Map(state.controllers);
      next.delete(assistantMessageId);

      return { controllers: next };
    }),

  editMessage: null,
  setEditMessage: (editMessage) => set({ editMessage }),

  isDragOver: false,
  setIsDragOver: (isDragOver) => set({ isDragOver }),

  scrollPosition: null,
  setScrollPosition: (value) => set({ scrollPosition: value }),

  // Default: 147px + 8px (positon bottom) + 16px (padding above)
  textareaHeight: 147 + 8 + 16,
  setTextareaHeight: (height) => set({ textareaHeight: Math.max(height, 147) + 8 + 16 }),

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
      assistantMessages: new Map(),
    })),
}));

export const chatStore = useChatStore;
