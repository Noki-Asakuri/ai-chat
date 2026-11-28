import { api } from "@ai-chat/backend/convex/_generated/api";

import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, stripSearchParams } from "@tanstack/react-router";

import { AutoSettleThreadsCard } from "./-components/account/auto-settle-threads-card";
import { SettleInactiveThreadsCard } from "./-components/account/settle-inactive-threads-card";
import { LIBRARY_SEARCH_DEFAULTS, librarySearchSchema } from "./-components/thread-library/library-search";
import { ThreadLibrary, threadLibraryQuery } from "./-components/thread-library/thread-library";

export const Route = createFileRoute("/settings/threads")({
  // Rendered in the browser only: date filters and relative times depend on the viewer's clock and
  // time zone, which the server doesn't share, so a server render could disagree with hydration.
  ssr: "data-only",
  validateSearch: librarySearchSchema,
  search: { middlewares: [stripSearchParams(LIBRARY_SEARCH_DEFAULTS)] },
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.query(convexQuery(api.functions.users.getCurrentUserPreferences)),
      context.queryClient.query(threadLibraryQuery),
    ]);
  },
  component: RouteComponent,
  head: () => ({ meta: [{ title: "Threads - AI Chat" }] }),
});

function RouteComponent() {
  const { data: preferences, isPending } = useSuspenseQuery(
    convexQuery(api.functions.users.getCurrentUserPreferences),
  );

  return (
    <div className="flex flex-col gap-10">
      <ThreadLibrary />

      <section aria-labelledby="thread-housekeeping-heading" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="thread-housekeeping-heading" className="text-lg font-semibold tracking-tight">
            Housekeeping
          </h2>
          <p className="text-sm text-pretty text-muted-foreground">
            Settled threads leave the sidebar but stay in your library, ready to unsettle.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <AutoSettleThreadsCard
            key={preferences?.threads?.autoSettleDays ?? 0}
            disabled={isPending}
            initialDays={preferences?.threads?.autoSettleDays ?? 0}
          />
          <SettleInactiveThreadsCard />
        </div>
      </section>
    </div>
  );
}
