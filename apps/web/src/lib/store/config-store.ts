import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { create } from "zustand";

import type { ReasoningEffort } from "../types";

type ChatConfig = {
  model: string;
  defaultModel: string;
  effort: ReasoningEffort;
  webSearch: boolean;
  profile?: Id<"profiles"> | null;

  pref: "enter" | "ctrlEnter";
};

type UserCustomization = {
  wrapline: boolean;
  showFullCode: boolean;
  notificationSound: boolean;
  desktopNotification: boolean;
  hiddenModels: string[];
  favoriteModels: string[];
};

export type ConfigStoreData = ChatConfig & UserCustomization;

export type ConfigStore = ConfigStoreData & {
  setConfig: (
    config: Partial<
      ChatConfig & Pick<UserCustomization, "notificationSound" | "desktopNotification">
    >,
  ) => void;
  toggleWrapline: () => void;
  setHiddenModels: (hiddenModels: string[]) => void;
  setFavoriteModels: (favoriteModels: string[]) => void;
  setServerState: (nextState: Partial<ConfigStoreData>) => void;
};

export function createConfigStore(initialState: Partial<ConfigStoreData>) {
  return create<ConfigStore>()((set) => ({
    effort: "medium",
    webSearch: false,
    defaultModel: "google/gemini-3-flash",
    model: "google/gemini-3-flash",
    profile: null,
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
