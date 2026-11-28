import { createContext, use, useEffect, useState } from "react";
import { useStore } from "zustand";

import type { InitialChatProfile } from "@/lib/profiles/chat-profile";
import { createConfigStore, type ConfigServerState, type ConfigStore } from "@/lib/store/config-store";

export const ConfigStoreContext = createContext<ReturnType<typeof createConfigStore> | null>(null);

type ConfigStoreProviderProps = {
  children: React.ReactNode;
  initialState: ConfigServerState;
  /** Read once when the store is made, so the chat shows its profile from the first paint. */
  getInitialProfile?: () => InitialChatProfile | undefined;
};

export function ConfigStoreProvider(props: ConfigStoreProviderProps) {
  const [store] = useState(() => {
    const created = createConfigStore(props.initialState);
    const initialProfile = props.getInitialProfile?.();
    if (initialProfile) {
      created.setState((state) => ({
        profileChosen: initialProfile.chosen,
        modelParams: { ...state.modelParams, profile: initialProfile.profile },
      }));
    }
    return created;
  });

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
