import type { Doc, Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { RemoveAllExceptFunctions } from "../types";

export type GroupedThreads = {
  activeGroupId: Id<"groups"> | null;
  groups: Doc<"groups">[];
  threads: Doc<"threads">[];
  hasMore: boolean;
};

export type ThreadStore = {
  groupedThreads: GroupedThreads;
  setGroupedThreads: (groupedThreads: GroupedThreads) => void;

  activeGroupId: Id<"groups"> | null;
  setActiveGroupId: (groupId: Id<"groups"> | null) => void;

  threadCommandOpen: boolean;
  setThreadCommandOpen: (open: boolean | ((open: boolean) => boolean)) => void;
};

export const useThreadStore = create<ThreadStore>()(
  persist(
    (set) => ({
      groupedThreads: {
        activeGroupId: null,
        groups: [],
        threads: [],
        hasMore: false,
      },
      setGroupedThreads: (groupedThreads) => set({ groupedThreads }),

      activeGroupId: null,
      setActiveGroupId: (activeGroupId) => set({ activeGroupId }),

      threadCommandOpen: false,
      setThreadCommandOpen: (open) =>
        set((state) => ({
          threadCommandOpen: typeof open === "function" ? open(state.threadCommandOpen) : open,
        })),
    }),
    {
      name: "local-threads-cache",
      version: 2,
      storage: createJSONStorage(() => localStorage),

      partialize: (state) => ({
        groupedThreads: state.groupedThreads,
        activeGroupId: state.activeGroupId,
      }),
    },
  ),
);

export const threadStoreActions =
  useThreadStore.getInitialState() as RemoveAllExceptFunctions<ThreadStore>;
