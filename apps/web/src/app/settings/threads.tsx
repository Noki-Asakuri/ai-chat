import { api } from "@ai-chat/backend/convex/_generated/api";

import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { SettingsSection } from "@/components/settings/settings-section";
import { Separator } from "@/components/ui/separator";
import { convexSessionQuery } from "@/lib/convex/helpers";

import { AccountThreadsTable } from "./-components/account/account-threads-table";
import { AutoSettleThreadsCard } from "./-components/account/auto-settle-threads-card";
import { SettleInactiveThreadsCard } from "./-components/account/settle-inactive-threads-card";

export const Route = createFileRoute("/settings/threads")({
  component: RouteComponent,
  head: () => ({ meta: [{ title: "Threads - AI Chat" }] }),
});

function RouteComponent() {
  const { data: preferences, isPending } = useSuspenseQuery(
    convexSessionQuery(api.functions.users.getCurrentUserPreferences),
  );

  return (
    <div className="flex flex-col gap-8">
      <AutoSettleThreadsCard disabled={isPending} initialDays={preferences?.threads?.autoSettleDays ?? 0} />
      <Separator />
      <SettleInactiveThreadsCard />
      <Separator />
      <SettingsSection
        id="thread-library"
        title="Thread library"
        description="Find conversations, update pins, or remove threads you no longer need."
      >
        <AccountThreadsTable />
      </SettingsSection>
    </div>
  );
}
