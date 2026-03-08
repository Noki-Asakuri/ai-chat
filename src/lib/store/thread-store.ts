import type { Doc, Id } from "@/convex/_generated/dataModel";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { ReasoningEffort, RemoveAllExceptFunctions } from "../types";

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

export type ThreadModelParams = {
  effort: ReasoningEffort;
  webSearch: boolean;
  profile: Id<"profiles"> | null;
};

export type ThreadModelConfig = {
  model: string;
  modelParams: ThreadModelParams;
};

export function isThreadModelConfigValid(
  value: ThreadModelConfig | undefined,
): value is ThreadModelConfig {
  if (!value) return false;
  if (!value.model || value.model.length === 0) return false;
  if (value.modelParams.profile !== null && typeof value.modelParams.profile !== "string") {
    return false;
  }

  const effort = value.modelParams.effort;
  if (
    effort !== "none" &&
    effort !== "minimal" &&
    effort !== "low" &&
    effort !== "medium" &&
    effort !== "high" &&
    effort !== "xhigh"
  ) {
    return false;
  }

  return typeof value.modelParams.webSearch === "boolean";
}

export function isSameThreadModelConfig(
  left: ThreadModelConfig | undefined,
  right: ThreadModelConfig,
): boolean {
  if (!left) return false;

  return (
    left.model === right.model &&
    left.modelParams.effort === right.modelParams.effort &&
    left.modelParams.webSearch === right.modelParams.webSearch &&
    left.modelParams.profile === right.modelParams.profile
  );
}

export type ThreadStore = {
  groupedThreads: GroupedThreads;
  setGroupedThreads: (groupedThreads: GroupedThreads) => void;

  threadModelConfigById: Record<Id<"threads">, ThreadModelConfig>;
  setThreadModelConfig: (threadId: Id<"threads">, config: ThreadModelConfig) => void;
  removeThreadModelConfig: (threadId: Id<"threads">) => void;

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

      threadModelConfigById: {},
      setThreadModelConfig: (threadId, config) =>
        set((state) => {
          const previous = state.threadModelConfigById[threadId];
          if (isSameThreadModelConfig(previous, config)) return state;

          return {
            threadModelConfigById: {
              ...state.threadModelConfigById,
              [threadId]: config,
            },
          };
        }),
      removeThreadModelConfig: (threadId) =>
        set((state) => {
          if (!state.threadModelConfigById[threadId]) return state;

          const next = { ...state.threadModelConfigById };
          delete next[threadId];

          return { threadModelConfigById: next };
        }),

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
      version: 1,
      storage: createJSONStorage(() => localStorage),

      migrate: (persistedState) => {
        const value = persistedState as
          | {
              groupedThreads?: GroupedThreads;
              threadModelConfigById?: Record<Id<"threads">, ThreadModelConfig>;
              threads?: GroupedThreads;
            }
          | undefined;

        return {
          groupedThreads: value?.groupedThreads ??
            value?.threads ?? {
              groupedThreads: { none: { group: null, threads: [] } },
              groups: [],
              threads: [],
              length: 0,
            },
          threadModelConfigById: value?.threadModelConfigById ?? {},
        } satisfies Pick<ThreadStore, "groupedThreads" | "threadModelConfigById">;
      },

      partialize: (state) => ({
        groupedThreads: state.groupedThreads,
        threadModelConfigById: state.threadModelConfigById,
      }),
    },
  ),
);

export const threadStoreActions =
  useThreadStore.getInitialState() as RemoveAllExceptFunctions<ThreadStore>;
