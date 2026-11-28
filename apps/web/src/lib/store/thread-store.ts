import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { z } from "zod";

import type { RemoveAllExceptFunctions } from "../types";

const PersistedThreadStoreSchema = z
  .object({
    // setActiveGroupId only ever persists Convex group ids, so any string here is one.
    activeGroupId: z.string().pipe(z.custom<Id<"groups">>()).nullable().catch(null),
  })
  .catch({ activeGroupId: null });

export type ThreadStore = {
  activeGroupId: Id<"groups"> | null;
  setActiveGroupId: (groupId: Id<"groups"> | null) => void;

  /** Bumped by every "new chat", so the composer starts over with the group's defaults. */
  newChatKey: number;
  /** Make `groupId` active and start a fresh chat in it, even if one is already open. */
  startNewChat: (groupId: Id<"groups"> | null) => void;

  threadCommandOpen: boolean;
  setThreadCommandOpen: (open: boolean | ((open: boolean) => boolean)) => void;
};

export const useThreadStore = create<ThreadStore>()(
  persist(
    (set) => ({
      activeGroupId: null,
      setActiveGroupId: (activeGroupId) => set({ activeGroupId }),

      newChatKey: 0,
      startNewChat: (activeGroupId) => set((state) => ({ activeGroupId, newChatKey: state.newChatKey + 1 })),

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
        return { activeGroupId };
      },
      storage: createJSONStorage(() => localStorage),

      partialize: (state) => ({
        activeGroupId: state.activeGroupId,
      }),
    },
  ),
);

export const threadStoreActions: RemoveAllExceptFunctions<ThreadStore> = useThreadStore.getInitialState();
