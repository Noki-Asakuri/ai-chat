import { api } from "@/convex/_generated/api";

import { useSessionMutation } from "convex-helpers/react/sessions";

import { useCallback, useContext } from "react";

import { ConfigStoreContext } from "@/components/provider/config-provider";

import type { SendPreference } from "./send-preference";

import { tryCatch } from "@/lib/utils";

export function useUpdateSendPreference() {
  const configStore = useContext(ConfigStoreContext);
  const updateUserPreferences = useSessionMutation(api.functions.users.updateUserPreferences);

  return useCallback(
    async function updateSendPreference(nextPreference: SendPreference): Promise<Error | null> {
      const previousPreference = configStore ? configStore.getState().pref : null;

      if (previousPreference === nextPreference) {
        return null;
      }

      if (configStore) {
        configStore.getState().setConfig({ pref: nextPreference });
      }

      const [, error] = await tryCatch(
        updateUserPreferences({ data: { sendPreference: nextPreference } }),
      );

      if (!error) {
        return null;
      }

      if (
        configStore &&
        previousPreference !== null &&
        configStore.getState().pref === nextPreference
      ) {
        configStore.getState().setConfig({ pref: previousPreference });
      }

      return error;
    },
    [configStore, updateUserPreferences],
  );
}
