import { createContext, useContext, useRef } from "react";

import {
  createConfigStore,
  type ConfigStore,
  type ConfigStoreData,
} from "@/lib/store/config-store";
import { useStore } from "zustand";

export const ConfigStoreContext = createContext<ReturnType<typeof createConfigStore> | null>(null);

export function ConfigStoreProvider({
  children,
  initialState,
}: {
  children: React.ReactNode;
  initialState: Partial<ConfigStoreData>;
}) {
  const store = useRef(createConfigStore(initialState));

  return (
    <ConfigStoreContext.Provider value={store.current}>{children}</ConfigStoreContext.Provider>
  );
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
