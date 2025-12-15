import { createFileRoute } from "@tanstack/react-router";

import { AccountThreadsTable } from "./-components/account/account-threads-table";

export const Route = createFileRoute("/settings/account")({
  component: RouteComponent,
  head: () => ({ meta: [{ title: "Account - AI Chat" }] }),
});

function RouteComponent() {
  return <AccountThreadsTable />;
}
