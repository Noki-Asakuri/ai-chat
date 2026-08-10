import { createFileRoute } from "@tanstack/react-router";

import { AccountThreadsTable } from "./-components/account/account-threads-table";
import { SettleInactiveThreadsCard } from "./-components/account/settle-inactive-threads-card";

export const Route = createFileRoute("/settings/threads")({
  component: RouteComponent,
  head: () => ({ meta: [{ title: "Threads - AI Chat" }] }),
});

function RouteComponent() {
  return (
    <div className="space-y-6">
      <SettleInactiveThreadsCard />
      <AccountThreadsTable />
    </div>
  );
}
