import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { create } from "zustand";

import type { ReasoningEffort } from "../types";

type ChatConfig = {
  model: string;
  defaultModel: string;
  modelParams: {
    effort: ReasoningEffort;
    webSearch: boolean;
    profile: Id<"profiles"> | null;
  };

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
  toggleWrapline: () => void;

  setConfig: (config: Partial<ChatConfig>) => void;
  setModelParams: (modelParams: Partial<ChatConfig["modelParams"]>) => void;

  setHiddenModels: (hiddenModels: string[]) => void;
  setFavoriteModels: (favoriteModels: string[]) => void;
  setServerState: (nextState: Partial<ConfigStoreData>) => void;
};

export function createConfigStore(initialState: Partial<ConfigStoreData>) {
  return create<ConfigStore>()((set) => ({
    model: "google/gemini-3-flash",
    defaultModel: "google/gemini-3-flash",
    modelParams: { effort: "medium", webSearch: false, profile: null },

    pref: "enter",

    setConfig: (config) => set((state) => ({ ...state, ...config })),
    setModelParams: (modelParams) =>
      set((state) => ({ modelParams: { ...state.modelParams, ...modelParams } })),

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
