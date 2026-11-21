import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { z } from "zod";

import type { RemoveAllExceptFunctions } from "../types";

const PersistedThreadStoreSchema = z
  .object({ activeGroupId: z.string().nullable().catch(null) })
  .catch({ activeGroupId: null });

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
          threadCommandOpen: open === true || open === false ? open : open(state.threadCommandOpen),
        })),
    }),
    {
      name: "local-threads-cache",
      version: 3,
      migrate: (persisted) => {
        const { activeGroupId } = PersistedThreadStoreSchema.parse(persisted);
        // SAFETY: activeGroupId was written by setActiveGroupId, which only accepts Id<"groups">.
        return { activeGroupId: activeGroupId as Id<"groups"> | null };
      },
      storage: createJSONStorage(() => localStorage),

      partialize: (state) => ({
        activeGroupId: state.activeGroupId,
      }),
    },
  ),
);

export const threadStoreActions: RemoveAllExceptFunctions<ThreadStore> = useThreadStore.getInitialState();
