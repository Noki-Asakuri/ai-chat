import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { RemoveAllExceptFunctions } from "../types";

type ThreadGroupUIStore = {
  /**
   * Map of stable group keys -> open state.
   *
   * Keys:
   * - User groups: `group:${groupId}`
   * - Default time-based groups: `ungrouped:${groupKey}`
   */
  isOpenByKey: Record<string, boolean>;

  setGroupOpen: (key: string, isOpen: boolean) => void;
  toggleGroupOpen: (key: string) => void;
};

export const useThreadGroupUIStore = create<ThreadGroupUIStore>()(
  persist(
    (set) => ({
      isOpenByKey: {},

      setGroupOpen: (key, isOpen) =>
        set((state) => ({
          isOpenByKey: { ...state.isOpenByKey, [key]: isOpen },
        })),

      toggleGroupOpen: (key) =>
        set((state) => ({
          isOpenByKey: { ...state.isOpenByKey, [key]: !(state.isOpenByKey[key] ?? true) },
        })),
    }),
    {
      name: "local-thread-group-ui",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ isOpenByKey: state.isOpenByKey }),
    },
  ),
);

export function getUserGroupKey(groupId: string): string {
  return `group:${groupId}`;
}

export function getUngroupedBucketKey(groupKey: string): string {
  return `ungrouped:${groupKey}`;
}

export const threadGroupUIStoreActions =
  useThreadGroupUIStore.getInitialState() as RemoveAllExceptFunctions<ThreadGroupUIStore>;
