import { createContext, useContext, useEffect, useRef } from "react";

import {
  createConfigStore,
  type ConfigStore,
  type ConfigStoreData,
} from "@/lib/store/config-store";
import { useStore } from "zustand";

export const ConfigStoreContext = createContext<ReturnType<typeof createConfigStore> | null>(null);

type ConfigStoreProviderProps = {
  children: React.ReactNode;
  initialState: Partial<ConfigStoreData>;
};

function arraysEqual(left: readonly string[], right: readonly string[]) {
  if (left.length !== right.length) return false;

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }

  return true;
}

function shouldPatchConfigStore(
  currentState: ConfigStoreData,
  nextState: Partial<ConfigStoreData>,
): boolean {
  if (nextState.model !== undefined && currentState.model !== nextState.model) return true;
  if (nextState.defaultModel !== undefined && currentState.defaultModel !== nextState.defaultModel)
    return true;

  if (nextState.effort !== undefined && currentState.effort !== nextState.effort) return true;
  if (nextState.webSearch !== undefined && currentState.webSearch !== nextState.webSearch)
    return true;

  if (nextState.profile !== undefined && currentState.profile !== nextState.profile) return true;
  if (nextState.pref !== undefined && currentState.pref !== nextState.pref) return true;

  if (nextState.wrapline !== undefined && currentState.wrapline !== nextState.wrapline) return true;

  if (
    nextState.defaultShowFullCode !== undefined &&
    currentState.defaultShowFullCode !== nextState.defaultShowFullCode
  ) {
    return true;
  }

  if (
    nextState.hiddenModels !== undefined &&
    !arraysEqual(currentState.hiddenModels, nextState.hiddenModels)
  ) {
    return true;
  }

  if (
    nextState.favoriteModels !== undefined &&
    !arraysEqual(currentState.favoriteModels, nextState.favoriteModels)
  ) {
    return true;
  }

  return false;
}

export function ConfigStoreProvider(props: ConfigStoreProviderProps) {
  const storeRef = useRef<ReturnType<typeof createConfigStore> | null>(null);
  if (!storeRef.current) {
    storeRef.current = createConfigStore(props.initialState);
  }

  const store = storeRef.current;

  useEffect(() => {
    const currentState = store.getState();
    if (!shouldPatchConfigStore(currentState, props.initialState)) return;

    store.setState(props.initialState);
  }, [props.initialState, store]);

  return <ConfigStoreContext.Provider value={store}>{props.children}</ConfigStoreContext.Provider>;
}

export function useConfigStore<T>(selector: (state: ConfigStore) => T): T {
  const configStore = useContext(ConfigStoreContext);
  if (!configStore) throw new Error("useConfigStore must be used within a ConfigStoreProvider");

  return useStore(configStore, selector);
}

export function useConfigStoreState() {
  const configStore = useContext(ConfigStoreContext);
  if (!configStore) throw new Error("useConfigStore must be used within a ConfigStoreProvider");

  return configStore.getState();
}
