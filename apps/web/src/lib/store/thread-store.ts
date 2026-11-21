import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { RemoveAllExceptFunctions } from "../types";

export type ThreadStore = {
  activeGroupId: Id<"groups"> | null;
  setActiveGroupId: (groupId: Id<"groups"> | null) => void;

  threadCommandOpen: boolean;
  setThreadCommandOpen: (open: boolean | ((open: boolean) => boolean)) => void;
};

export const useThreadStore = create<ThreadStore>()(
  persist(
    (set) => ({
      activeGroupId: null,
      setActiveGroupId: (activeGroupId) => set({ activeGroupId }),

      threadCommandOpen: false,
      setThreadCommandOpen: (open) =>
        set((state) => ({
          threadCommandOpen:
            open === true || open === false ? open : open(state.threadCommandOpen),
        })),
    }),
    {
      name: "local-threads-cache",
      version: 3,
      migrate: () => ({ activeGroupId: null }),
      storage: createJSONStorage(() => localStorage),

      partialize: (state) => ({
        activeGroupId: state.activeGroupId,
      }),
    },
  ),
);

export const threadStoreActions: RemoveAllExceptFunctions<ThreadStore> =
  useThreadStore.getInitialState();
