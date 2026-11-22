import { createContext, use, useEffect, useState } from "react";
import { useStore } from "zustand";

import {
  createConfigStore,
  type ComposerModelConfig,
  type ConfigStore,
  type ConfigStoreData,
} from "@/lib/store/config-store";

export const ConfigStoreContext = createContext<ReturnType<typeof createConfigStore> | null>(null);

type ConfigStoreProviderProps = {
  children: React.ReactNode;
  /** Account preferences. They are reapplied whenever they change. */
  initialState: Partial<ConfigStoreData>;
  /** The welcome page's starting model settings. Read once, when the store is created. */
  newThread?: ComposerModelConfig;
};

export function ConfigStoreProvider(props: ConfigStoreProviderProps) {
  const [store] = useState(() => createConfigStore(props.initialState, props.newThread));

  useEffect(() => {
    store.getState().setServerState(props.initialState);
  }, [props.initialState, store]);

  return <ConfigStoreContext.Provider value={store}>{props.children}</ConfigStoreContext.Provider>;
}

export function useConfigStore<T>(selector: (state: ConfigStore) => T): T {
  const configStore = use(ConfigStoreContext);
  if (!configStore) throw new Error("useConfigStore must be used within a ConfigStoreProvider");

  return useStore(configStore, selector);
}

export function useConfigStoreApi() {
  const configStore = use(ConfigStoreContext);
  if (!configStore) throw new Error("useConfigStore must be used within a ConfigStoreProvider");

  return configStore;
}

export function useConfigStoreState() {
  const configStore = use(ConfigStoreContext);
  if (!configStore) throw new Error("useConfigStore must be used within a ConfigStoreProvider");

  return configStore.getState();
}
