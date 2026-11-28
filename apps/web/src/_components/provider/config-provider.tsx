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
  // Part of the store's first state, not set afterwards: server rendering and hydration read
  // that first snapshot, so the profile shows from the very first paint.
  const [store] = useState(() => {
    const initialProfile = props.getInitialProfile?.();
    if (!initialProfile) return createConfigStore(props.initialState);
    return createConfigStore({
      ...props.initialState,
      profileChosen: initialProfile.chosen,
      modelParams: { ...props.initialState.modelParams, profile: initialProfile.profile },
    });
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
