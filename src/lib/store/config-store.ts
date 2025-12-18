import type { Id } from "@/convex/_generated/dataModel";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

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
  defaultShowFullCode: boolean;
  hiddenModels: string[];
};

export type ConfigStoreData = ChatConfig & UserCustomization;

export type ConfigStore = ConfigStoreData & {
  setConfig: (config: Partial<ChatConfig>) => void;
  toggleWrapline: () => void;
  setHiddenModels: (hiddenModels: string[]) => void;
};

export function createConfigStore(initialState: Partial<ConfigStoreData>) {
  return create<ConfigStore>()(
    persist(
      (set) => ({
        effort: "medium",
        webSearch: false,
        defaultModel: "google/gemini-3-flash",
        model: "google/gemini-3-flash",
        profile: null,
        pref: "enter",

        setConfig: (config) => set((state) => ({ ...state, ...config })),

        wrapline: false,
        toggleWrapline: () => set((state) => ({ wrapline: !state.wrapline })),

        defaultShowFullCode: false,

        hiddenModels: [],
        setHiddenModels: (hiddenModels) => set({ hiddenModels }),

        ...initialState,
      }),
      {
        name: "local-config-store",
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          effort: state.effort,
          webSearch: state.webSearch,
          model: state.model,
          defaultModel: state.defaultModel,
          profile: state.profile,
          wrapline: state.wrapline,
          pref: state.pref,
        }),
        onRehydrateStorage: () => (state) => {
          if (!state) return;

          const fallbackDefaultModel =
            state.defaultModel.trim().length > 0
              ? state.defaultModel
              : state.model.trim().length > 0
                ? state.model
                : "google/gemini-3-flash";

          const nextModel = state.model.trim().length > 0 ? state.model : fallbackDefaultModel;

          if (state.defaultModel !== fallbackDefaultModel || state.model !== nextModel) {
            state.setConfig({ defaultModel: fallbackDefaultModel, model: nextModel });
          }
        },
      },
    ),
  );
}
