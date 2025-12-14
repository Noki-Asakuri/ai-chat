import { api } from "@/convex/_generated/api";

import { convexQuery } from "@convex-dev/react-query";
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
  loader: async ({ context }) => {
    context.queryClient.ensureQueryData(
      convexQuery(api.functions.users.currentUser, { sessionId: context.sessionId }),
    );
  },
});

function RouteComponent() {
  const { data, isPending } = useSuspenseQuery(convexSessionQuery(api.functions.users.currentUser));
  const updateCustomization = useSessionMutation(api.functions.users.updateUserCustomization);

  const [pendingUpdate, startTransition] = useTransition();

  const disabled = pendingUpdate || isPending;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Models</h2>
        <p className="text-muted-foreground">Choose which models are visible in the model picker.</p>
      </div>

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
