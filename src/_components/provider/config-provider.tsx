import { createContext, useContext, useEffect, useRef } from "react";
import { useStore } from "zustand";

import {
  createConfigStore,
  type ConfigStore,
  type ConfigStoreData,
} from "@/lib/store/config-store";

export const ConfigStoreContext = createContext<ReturnType<typeof createConfigStore> | null>(null);

type ConfigStoreProviderProps = {
  children: React.ReactNode;
  initialState: Partial<ConfigStoreData>;
};

export function ConfigStoreProvider(props: ConfigStoreProviderProps) {
  const storeRef = useRef<ReturnType<typeof createConfigStore> | null>(null);

  if (!storeRef.current) {
    storeRef.current = createConfigStore(props.initialState);
  }

  useEffect(() => {
    storeRef.current?.getState().setServerState(props.initialState);
  }, [props.initialState]);

  return (
    <ConfigStoreContext.Provider value={storeRef.current}>
      {props.children}
    </ConfigStoreContext.Provider>
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
