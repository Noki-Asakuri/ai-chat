import { api } from "@/convex/_generated/api";

import { useSessionMutation } from "convex-helpers/react/sessions";

import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { convexSessionQuery } from "@/lib/convex/helpers";

import { ModelsEditor } from "./-components/models-editor";
import { LoadingSkeleton } from "./-pending";

export const Route = createFileRoute("/settings/models")({
  component: RouteComponent,
  pendingComponent: LoadingSkeleton,

  head: () => ({ meta: [{ title: "Models - AI Chat" }] }),
});

function RouteComponent() {
  const { data: preferences, isPending: isDisabled } = useSuspenseQuery(
    convexSessionQuery(api.functions.users.getCurrentUserPreferences),
  );
  const updateUserPreferences = useSessionMutation(api.functions.users.updateUserPreferences);

  return (
    <div className="space-y-6">
      <ModelsEditor
        disabled={isDisabled}
        initialHiddenModels={preferences?.models?.hidden ?? []}
        initialFavoriteModels={preferences?.models?.favorite ?? []}
        onSaveCustomization={async function onSaveCustomization(customization) {
          if (!preferences) return;

          await updateUserPreferences({
            data: { models: { ...preferences.models, ...customization } },
          });
        }}
      />
    </div>
  );
}
