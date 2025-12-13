import type { Id } from "@/convex/_generated/dataModel";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { ReasoningEffort } from "../types";

type ChatConfig = {
  model: string;
  effort: ReasoningEffort;
  webSearch: boolean;
  profile?: { id: Id<"profiles">; name: string; systemPrompt: string } | null;

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
        model: "google/gemini-2.5-flash",
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
          profile: state.profile,
          wrapline: state.wrapline,
          pref: state.pref,
        }),
      },
    ),
  );
}
