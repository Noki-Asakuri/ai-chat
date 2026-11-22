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

  /** Local only: the latest effort the user chose, until the server confirms it (see `EffortIntent`). */
  effortIntent: EffortIntent | null;
  setEffortIntent: (effortIntent: EffortIntent | null) => void;
};

/**
 * An effort the user chose for `model`, kept until a server snapshot shows it or a model change
 * replaces it. While it exists, server snapshots of the same model do not change the local effort,
 * because they may predate the save. `queued` means its debounced save has not been sent yet.
 */
export type EffortIntent = {
  id: number;
  model: string;
  effort: ReasoningEffort;
  queued: boolean;
};

let lastEffortIntentId = 0;

/** Clears the effort intent if it is still `id`, so a failed save does not pin the local effort. */
export function clearEffortIntent(store: { getState: () => ConfigStore }, id: number) {
  const state = store.getState();
  if (state.effortIntent?.id === id) state.setEffortIntent(null);
}

export function createEffortIntent(model: string, effort: ReasoningEffort, queued: boolean): EffortIntent {
  lastEffortIntentId += 1;
  return { id: lastEffortIntentId, model, effort, queued };
}

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

        const { modelParams: paramChanges, ...rest } = changes;
        const params = { ...paramChanges };
        let effortIntent = state.effortIntent;

        if (rest.model !== undefined && rest.model !== state.model) {
          // The server switched models (for example, a response variant was selected): a local
          // effort chosen for the previous model does not belong to the new one.
          effortIntent = null;
          if (next.modelParams) params.effort = next.modelParams.effort;
        } else if (effortIntent) {
          delete params.effort;
          const confirmed =
            (next.model ?? state.model) === effortIntent.model &&
            next.modelParams?.effort === effortIntent.effort;
          if (confirmed && !effortIntent.queued) effortIntent = null;
        }

        return { ...rest, modelParams: { ...state.modelParams, ...params }, effortIntent };
      }),

    effortIntent: null,
    setEffortIntent: (effortIntent) => set({ effortIntent }),

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
 * Returns the fields of `next` whose values differ from `previous`. The provider applies only these,
 * so a re-render that passes the same (possibly stale) server values does not overwrite local
 * changes, and a server update to one setting does not reset the others.
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
