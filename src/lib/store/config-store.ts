import type { Id } from "@/convex/_generated/dataModel";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { ReasoningEffort } from "../types";

type ChatConfig = {
  model: string;
  effort: ReasoningEffort;
  webSearch: boolean;
  profile?: { id: Id<"profiles">; name: string; systemPrompt: string } | null;
};

export type ConfigStore = ChatConfig & {
  setConfig: (config: Partial<ChatConfig>) => void;

  wrapline: boolean;
  toggleWrapline: () => void;
};

const DEFAULT_CONFIG: ChatConfig = {
  webSearch: false,
  effort: "medium",
  model: "openai/gpt-5-nano",
  profile: null,
} as const;

export const useConfigStore = create<ConfigStore>()(
  persist(
    (set) => ({
      ...DEFAULT_CONFIG,
      setConfig: (config) => set((state) => ({ ...state, ...config })),

      wrapline: false,
      toggleWrapline: () => set((state) => ({ wrapline: !state.wrapline })),
    }),
    {
      name: "local-config-store",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

export const configStore = useConfigStore.getInitialState();
