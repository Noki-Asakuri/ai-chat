import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";
import {
  applyThreadModelConfigPatch,
  type ThreadModelConfig,
  type ThreadModelConfigPatch,
} from "@ai-chat/shared/chat/thread-model-config";

import { create } from "zustand";

export type ComposerModelConfig = ThreadModelConfig<Id<"profiles">>;
export type ComposerModelConfigPatch = ThreadModelConfigPatch<Id<"profiles">>;

type ChatConfig = {
  pref: "enter" | "ctrlEnter";

  notificationSound: boolean;
  desktopNotification: boolean;
};

type UserCustomization = {
  wrapline: boolean;
  showFullCode: boolean;

  hiddenModels: string[];
  favoriteModels: string[];
};

export type ConfigStoreData = ChatConfig & UserCustomization;

export type ConfigStore = ConfigStoreData & {
  /**
   * The model settings for a chat that has no thread yet (the welcome page). They are used when the
   * first message creates the thread. A thread's own settings live only in Convex; read them with
   * `useComposerModelConfig`.
   */
  newThread: ComposerModelConfig;
  updateNewThread: (patch: ComposerModelConfigPatch) => void;

  toggleWrapline: () => void;

  setConfig: (config: Partial<ChatConfig>) => void;

  setHiddenModels: (hiddenModels: string[]) => void;
  setFavoriteModels: (favoriteModels: string[]) => void;
  setServerState: (nextState: Partial<ConfigStoreData>) => void;
};

export function createConfigStore(
  initialState: Partial<ConfigStoreData>,
  newThread: ComposerModelConfig = {
    model: "google/gemini-3-flash",
    modelParams: { effort: "medium", webSearch: false, profile: null },
  },
) {
  return create<ConfigStore>()((set) => ({
    newThread,
    updateNewThread: (patch) =>
      set((state) => ({ newThread: applyThreadModelConfigPatch(state.newThread, patch) })),

    pref: "enter",

    setConfig: (config) => set((state) => ({ ...state, ...config })),

    wrapline: false,
    toggleWrapline: () => set((state) => ({ wrapline: !state.wrapline })),

    showFullCode: false,

    notificationSound: true,
    desktopNotification: false,

    hiddenModels: [],
    setHiddenModels: (hiddenModels) => set({ hiddenModels }),

    favoriteModels: [],
    setFavoriteModels: (favoriteModels) => set({ favoriteModels }),

    setServerState: (nextState) => set(() => nextState),

    ...initialState,
  }));
}
