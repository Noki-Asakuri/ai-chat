import { createFileRoute } from "@tanstack/react-router";

import { AccountProfileCard } from "./-components/account/account-profile-card";
import { AccountSessionsCard } from "./-components/account/account-sessions-card";
import { AccountThreadsTable } from "./-components/account/account-threads-table";

export const Route = createFileRoute("/settings/account")({
  component: RouteComponent,
  head: () => ({ meta: [{ title: "Account - AI Chat" }] }),
});

function RouteComponent() {
  return (
    <div className="space-y-6">
      <AccountProfileCard />
      <AccountSessionsCard />
      <AccountThreadsTable />
    </div>
  );
}
