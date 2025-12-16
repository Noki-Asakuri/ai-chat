import { createFileRoute } from "@tanstack/react-router";

import { Suspense } from "react";

import {
  AccountThreadsTable,
  AccountThreadsTableSkeleton,
} from "./-components/account/account-threads-table";

export const Route = createFileRoute("/settings/account")({
  component: RouteComponent,
  head: () => ({ meta: [{ title: "Account - AI Chat" }] }),
});

function RouteComponent() {
  return (
    <Suspense fallback={<AccountThreadsTableSkeleton />}>
      <AccountThreadsTable />
    </Suspense>
  );
}
