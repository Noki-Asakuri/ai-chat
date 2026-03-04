import { createFileRoute } from "@tanstack/react-router";

import { AccountThreadsTable } from "./-components/account/account-threads-table";

export const Route = createFileRoute("/settings/threads")({
  component: RouteComponent,
  head: () => ({ meta: [{ title: "Threads - AI Chat" }] }),
});

function RouteComponent() {
  return <AccountThreadsTable />;
}
