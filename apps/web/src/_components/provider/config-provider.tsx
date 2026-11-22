import { createContext, use, useEffect, useRef, useState } from "react";
import { useStore } from "zustand";

import { createConfigStore, type ConfigStore, type ConfigStoreData } from "@/lib/store/config-store";

export const ConfigStoreContext = createContext<ReturnType<typeof createConfigStore> | null>(null);

type ConfigStoreProviderProps = {
  children: React.ReactNode;
  initialState: Partial<ConfigStoreData>;
};

export function ConfigStoreProvider(props: ConfigStoreProviderProps) {
  const [store] = useState(() => createConfigStore(props.initialState));
  const serverStateRef = useRef(props.initialState);

  // Apply only the server values that changed. `initialState` is often a new object on every
  // render, and reapplying all of it would undo local changes such as a model picked on the
  // welcome page. Thread settings saved from this client reach here through optimistic updates.
  useEffect(() => {
    store.getState().applyServerSnapshot(serverStateRef.current, props.initialState);
    serverStateRef.current = props.initialState;
  }, [props.initialState, store]);

  return <ConfigStoreContext.Provider value={store}>{props.children}</ConfigStoreContext.Provider>;
}

export function useConfigStore<T>(selector: (state: ConfigStore) => T): T {
  const configStore = use(ConfigStoreContext);
  if (!configStore) throw new Error("useConfigStore must be used within a ConfigStoreProvider");

  return useStore(configStore, selector);
}

export function useConfigStoreState() {
  const configStore = use(ConfigStoreContext);
  if (!configStore) throw new Error("useConfigStore must be used within a ConfigStoreProvider");

  return configStore.getState();
}
