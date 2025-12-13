import type { Doc, Id } from "@/convex/_generated/dataModel";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { RemoveAllExceptFunctions } from "../types";

type ActiveDraggingItem =
  | { type: "thread"; item: Doc<"threads"> }
  | { type: "group"; item: Doc<"groups"> };

type GroupedThreads = {
  groupedThreads: Record<
    Id<"groups"> | "none",
    { group: Doc<"groups"> | null; threads: Doc<"threads">[] }
  >;
  groups: Doc<"groups">[];
  threads: Doc<"threads">[];
  length: number;
};

export type ThreadStore = {
  groupedThreads: GroupedThreads;
  setGroupedThreads: (groupedThreads: GroupedThreads) => void;

  activeDraggingItem: ActiveDraggingItem | null;
  setActiveDraggingItem: (item: ActiveDraggingItem | null) => void;

  threadCommandOpen: boolean;
  setThreadCommandOpen: (open: boolean | ((open: boolean) => boolean)) => void;
};

export const useThreadStore = create<ThreadStore>()(
  persist(
    (set) => ({
      groupedThreads: {
        groupedThreads: { none: { group: null, threads: [] } },
        groups: [],
        threads: [],
        length: 0,
      },
      setGroupedThreads: (groupedThreads) => set({ groupedThreads }),

      activeDraggingItem: null,
      setActiveDraggingItem: (item) => set({ activeDraggingItem: item }),

      threadCommandOpen: false,
      setThreadCommandOpen: (open) =>
        set((state) => ({
          threadCommandOpen: typeof open === "function" ? open(state.threadCommandOpen) : open,
        })),
    }),
    {
      name: "local-threads-cache",
      storage: createJSONStorage(() => localStorage),

      partialize: (state) => ({ threads: state.groupedThreads }),
    },
  ),
);

export const threadStoreActions =
  useThreadStore.getInitialState() as RemoveAllExceptFunctions<ThreadStore>;
