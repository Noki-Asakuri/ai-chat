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
  const { data, isPending } = useSuspenseQuery(convexSessionQuery(api.functions.users.currentUser));
  const updateCustomization = useSessionMutation(api.functions.users.updateUserCustomization);

  const disabled = isPending;

  return (
    <div className="space-y-6">
      <ModelsEditor
        disabled={disabled}
        initialHiddenModels={data?.customization?.hiddenModels ?? []}
        initialFavoriteModels={data?.customization?.favoriteModels ?? []}
        onSaveCustomization={async function onSaveCustomization(customization) {
          await updateCustomization({
            data: customization,
          });
        }}
      />
    </div>
  );
}
