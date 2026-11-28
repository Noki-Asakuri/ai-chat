import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { create } from "zustand";

import type { ReasoningEffort } from "../types";

type ModelParams = {
  effort: ReasoningEffort;
  webSearch: boolean;
  profile: Id<"profiles"> | null;
};

type ChatConfig = {
  model: string;
  defaultModel: string;
  modelParams: ModelParams;
  /** The profile was picked by hand in this chat, so a group default must not replace it. */
  profileChosen: boolean;

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

/** What the server knows; a value left out (like a new chat's profile) keeps its current value. */
export type ConfigServerState = Partial<Omit<ConfigStoreData, "modelParams">> & {
  modelParams?: Partial<ModelParams>;
};

export type ConfigStore = ConfigStoreData & {
  toggleWrapline: () => void;

  setConfig: (config: Partial<ChatConfig>) => void;
  setModelParams: (modelParams: Partial<ChatConfig["modelParams"]>) => void;
  /** A profile picked by hand, which sticks until the chat starts over. */
  chooseProfile: (profile: Id<"profiles"> | null) => void;
  /** A group default, applied only while nothing was picked by hand. */
  applyDefaultProfile: (profile: Id<"profiles"> | null, options?: { force?: boolean }) => void;

  setHiddenModels: (hiddenModels: string[]) => void;
  setFavoriteModels: (favoriteModels: string[]) => void;
  setServerState: (nextState: ConfigServerState) => void;
};

export function createConfigStore(initialState: ConfigServerState) {
  return create<ConfigStore>()((set) => ({
    model: "google/gemini-3-flash",
    defaultModel: "google/gemini-3-flash",
    pref: "enter",

    setConfig: (config) => set((state) => ({ ...state, ...config })),
    setModelParams: (modelParams) =>
      set((state) => ({ modelParams: { ...state.modelParams, ...modelParams } })),

    profileChosen: false,
    chooseProfile: (profile) =>
      set((state) => ({ profileChosen: true, modelParams: { ...state.modelParams, profile } })),
    applyDefaultProfile: (profile, options) =>
      set((state) => {
        if (state.profileChosen && !options?.force) return state;
        return { profileChosen: false, modelParams: { ...state.modelParams, profile } };
      }),

    wrapline: false,
    toggleWrapline: () => set((state) => ({ wrapline: !state.wrapline })),

    showFullCode: false,

    notificationSound: true,
    desktopNotification: false,

    hiddenModels: [],
    setHiddenModels: (hiddenModels) => set({ hiddenModels }),

    favoriteModels: [],
    setFavoriteModels: (favoriteModels) => set({ favoriteModels }),

    setServerState: (nextState) =>
      set((state) => ({
        ...nextState,
        modelParams: { ...state.modelParams, ...nextState.modelParams },
      })),

    ...initialState,
    modelParams: { effort: "medium", webSearch: false, profile: null, ...initialState.modelParams },
  }));
}
