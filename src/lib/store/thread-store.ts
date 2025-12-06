import type { Doc } from "@/convex/_generated/dataModel";

import { create } from "zustand";

import type { Thread } from "../types";

export interface ThreadStore {
  threads: Thread[];
  setThreads: (threads: Thread[]) => void;

  activeDraggingItem:
    | { type: "thread"; item: Doc<"threads"> }
    | { type: "group"; item: Doc<"groups"> }
    | null;
  setActiveDraggingItem: (
    item: { type: "thread"; item: Doc<"threads"> } | { type: "group"; item: Doc<"groups"> } | null,
  ) => void;

  threadCommandOpen: boolean;
  setThreadCommandOpen: (open: boolean | ((open: boolean) => boolean)) => void;
}

export const useThreadStore = create<ThreadStore>((set) => ({
  threads: [],
  setThreads: (threads) => set({ threads }),

  activeDraggingItem: null,
  setActiveDraggingItem: (item) => set({ activeDraggingItem: item }),

  threadCommandOpen: false,
  setThreadCommandOpen: (open) =>
    set((state) => ({
      threadCommandOpen: typeof open === "function" ? open(state.threadCommandOpen) : open,
    })),
}));

export const threadStore = useThreadStore;
