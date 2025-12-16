import { api } from "@/convex/_generated/api";

import { useSessionMutation } from "convex-helpers/react/sessions";

import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useTransition } from "react";
import { toast } from "sonner";

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

  const [pendingUpdate, startTransition] = useTransition();

  const disabled = pendingUpdate || isPending;

  return (
    <div className="space-y-6">
      <ModelsEditor
        disabled={disabled}
        initialHiddenModels={data?.customization?.hiddenModels ?? []}
        onSave={(hiddenModels) => {
          startTransition(async function () {
            toast.promise(updateCustomization({ data: { hiddenModels } }), {
              loading: "Saving preferences...",
              success: "Preferences saved",
              error: "Failed to save preferences",
            });
          });
        }}
      />
    </div>
  );
}
