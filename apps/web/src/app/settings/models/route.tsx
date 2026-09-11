import { api } from "@ai-chat/backend/convex/_generated/api";

import { useMutation } from "convex/react";

import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { convexQuery } from "@convex-dev/react-query";

import { ModelsEditor } from "./-components/models-editor";
import { LoadingSkeleton } from "./-pending";

export const Route = createFileRoute("/settings/models")({
  loader: async ({ context }) => {
    await context.queryClient.query({
      ...convexQuery(api.functions.users.getCurrentUserPreferences),
      staleTime: "static",
    });
  },
  component: RouteComponent,
  pendingComponent: LoadingSkeleton,

  head: () => ({ meta: [{ title: "Models - AI Chat" }] }),
});

function RouteComponent() {
  const { data: preferences, isPending: isDisabled } = useSuspenseQuery(
    convexQuery(api.functions.users.getCurrentUserPreferences),
  );
  const updateUserPreferences = useMutation(
    api.functions.users.updateUserModelPreferences,
  ).withOptimisticUpdate((store, { data }) => {
    const current = store.getQuery(api.functions.users.getCurrentUserPreferences, {});
    if (current) {
      store.setQuery(
        api.functions.users.getCurrentUserPreferences,
        {},
        {
          ...current,
          models: { ...current.models, ...data },
        },
      );
    }
  });

  return (
    <ModelsEditor
      disabled={isDisabled}
      initialHiddenModels={preferences?.models?.hidden ?? []}
      initialFavoriteModels={preferences?.models?.favorite ?? []}
      onSaveCustomization={async function onSaveCustomization(customization) {
        await updateUserPreferences({ data: customization });
      }}
    />
  );
}
