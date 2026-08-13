import { createFileRoute } from "@tanstack/react-router";

import { SettingsSection } from "@/components/settings/settings-section";
import { Separator } from "@/components/ui/separator";

import { AccountThreadsTable } from "./-components/account/account-threads-table";
import { SettleInactiveThreadsCard } from "./-components/account/settle-inactive-threads-card";

export const Route = createFileRoute("/settings/threads")({
  component: RouteComponent,
  head: () => ({ meta: [{ title: "Threads - AI Chat" }] }),
});

function RouteComponent() {
  return (
    <div className="flex flex-col gap-8">
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
