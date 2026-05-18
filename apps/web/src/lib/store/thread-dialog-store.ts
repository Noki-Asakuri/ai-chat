import type { Doc } from "@ai-chat/backend/convex/_generated/dataModel";

import { create } from "zustand";

import type { RemoveAllExceptFunctions } from "../types";

type ThreadDialogType = "edit" | "delete" | "share";

type ThreadDialogStore = {
  activeDialog: ThreadDialogType | null;
  thread: Doc<"threads"> | null;

  openEditThread: (thread: Doc<"threads">) => void;
  openDeleteThread: (thread: Doc<"threads">) => void;
  openShareThread: (thread: Doc<"threads">) => void;
  closeThreadDialog: () => void;
};

export const useThreadDialogStore = create<ThreadDialogStore>()((set) => ({
  activeDialog: null,
  thread: null,

  openEditThread: (thread) => set({ activeDialog: "edit", thread }),
  openDeleteThread: (thread) => set({ activeDialog: "delete", thread }),
  openShareThread: (thread) => set({ activeDialog: "share", thread }),
  closeThreadDialog: () => set({ activeDialog: null, thread: null }),
}));

export const threadDialogStoreActions =
  useThreadDialogStore.getInitialState() as RemoveAllExceptFunctions<ThreadDialogStore>;
