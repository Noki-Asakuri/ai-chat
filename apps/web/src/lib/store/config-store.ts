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

type ModelParams = ChatConfig["modelParams"];

/** Server values that changed since the previous snapshot; `modelParams` holds only changed params. */
export type ServerStateChanges = Partial<Omit<ConfigStoreData, "modelParams">> & {
  modelParams?: Partial<ModelParams>;
};

export type ConfigStore = ConfigStoreData & {
  toggleWrapline: () => void;

  setConfig: (config: Partial<ChatConfig>) => void;
  setModelParams: (modelParams: Partial<ChatConfig["modelParams"]>) => void;

  setHiddenModels: (hiddenModels: string[]) => void;
  setFavoriteModels: (favoriteModels: string[]) => void;
  /** Applies the server values that changed between two snapshots (see `getServerStateChanges`). */
  applyServerSnapshot: (previous: Partial<ConfigStoreData>, next: Partial<ConfigStoreData>) => void;
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

    applyServerSnapshot: (previous, next) =>
      set((state) => {
        const changes = getServerStateChanges(previous, next);
        if (!changes) return {};

        const { modelParams, ...rest } = changes;
        return { ...rest, modelParams: { ...state.modelParams, ...modelParams } };
      }),

    ...initialState,
  }));
}

function sameValue<V>(a: V, b: V) {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => item === b[index]);
  }
  return a === b;
}

function changedEntries<T extends object>(previous: Partial<T>, next: Partial<T>): Partial<T> {
  const changes: Partial<T> = {};
  for (const key in next) {
    if (!sameValue(previous[key], next[key])) changes[key] = next[key];
  }
  return changes;
}

/**
 * Returns the fields of `next` whose values differ from `previous`. The provider applies only these:
 * the chat layout passes a new object on every render, and reapplying all of it would replace
 * local changes (such as a model picked on the welcome page) with the same server values.
 */
export function getServerStateChanges(
  previous: Partial<ConfigStoreData>,
  next: Partial<ConfigStoreData>,
): ServerStateChanges | null {
  const { modelParams: previousParams, ...previousRest } = previous;
  const { modelParams: nextParams, ...nextRest } = next;

  const changes: ServerStateChanges = changedEntries(previousRest, nextRest);
  if (nextParams) {
    const paramChanges = changedEntries<ModelParams>(previousParams ?? {}, nextParams);
    if (Object.keys(paramChanges).length > 0) changes.modelParams = paramChanges;
  }

  return Object.keys(changes).length > 0 ? changes : null;
}
