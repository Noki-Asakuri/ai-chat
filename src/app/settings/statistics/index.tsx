import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { convexQuery } from "@convex-dev/react-query";
import { ResponsiveCalendar, type CalendarTooltipProps } from "@nivo/calendar";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icons } from "@/components/ui/icons";

import { getModelData } from "@/lib/chat/models";
import { format, toUUID } from "@/lib/utils";

import { LoadingSkeleton } from "./-pending";

export const Route = createFileRoute("/settings/statistics/")({
  component: StatisticsPage,
  pendingComponent: LoadingSkeleton,
  head: () => ({ meta: [{ title: "Statistics - AI Chat" }] }),

  loader: async ({ context }) => {
    const data = await context.queryClient.ensureQueryData(
      convexQuery(api.functions.statistics.getStatistics),
    );

    return { statistics: data };
  },
});

function StatisticsPage() {
  const statistics = useSuspenseQuery(convexQuery(api.functions.statistics.getStatistics));
  const thisYear = new Date(Date.now());

  const { stats, modelRank, threadRank, activity, aiProfileRank } = statistics.data!;

  return (
    <main className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Statistics</h2>
        <p className="text-muted-foreground">View your chat statistics and activity.</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Card className="rounded-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-normal text-gray-400">Threads</CardTitle>
          </CardHeader>

          <CardContent>
            <div className="text-3xl font-bold">{format.number(stats.threads)}</div>
          </CardContent>
        </Card>

        <Card className="rounded-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-normal text-gray-400">Assistant</CardTitle>
          </CardHeader>

          <CardContent>
            <div className="text-3xl font-bold">{format.number(stats.messages.assistant)}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Words: {format.number(stats.wordsByRole?.assistant ?? 0)}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-normal text-gray-400">User</CardTitle>
          </CardHeader>

          <CardContent>
            <div className="text-3xl font-bold">{format.number(stats.messages.user)}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Words: {format.number(stats.wordsByRole?.user ?? 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="flex justify-between">
          <h2 className="text-xl font-semibold">Activity in the {thisYear.getFullYear()}</h2>
        </div>

        <div className="mt-4 h-42">
          <ResponsiveCalendar
            data={activity}
            from={new Date(thisYear.getFullYear(), 0, 1).toISOString()}
            to={thisYear.toISOString()}
            colors={["#0e4429", "#006d32", "#26a641", "#39d353"]}
            emptyColor="var(--border)"
            monthBorderWidth={0}
            daySpacing={2}
            dayBorderColor="transparent"
            theme={{
              background: "var(--background)",
              text: { fill: "var(--foreground)" },
            }}
            tooltip={CalendarTooltip}
          />
        </div>

        <div className="mt-2 flex justify-between">
          <p className="text-sm">
            A total of {format.number(activity.reduce((sum, d) => sum + d.value, 0))} user messages
            sent in the {thisYear.getFullYear()} with a peak of{" "}
            {format.number(Math.max(...activity.map((d) => d.value)))} messages on a single day.
          </p>

          <div className="flex items-center gap-2 text-xs text-foreground/70">
            <p>Inactive</p>
            <div className="size-4 rounded-xs" style={{ backgroundColor: "var(--border)" }} />
            <div className="size-4 rounded-xs" style={{ backgroundColor: "#0e4429" }} />
            <div className="size-4 rounded-xs" style={{ backgroundColor: "#006d32" }} />
            <div className="size-4 rounded-xs" style={{ backgroundColor: "#26a641" }} />
            <div className="size-4 rounded-xs" style={{ backgroundColor: "#39d353" }} />
            <p>Active</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-1 lg:grid-cols-2">
        <div>
          <h2 className="text-xl font-semibold">Model Usage Rank</h2>
          <div className="mt-4 flex text-gray-500">
            <p className="w-2/3">Model</p>
            <p className="w-1/3 text-right">Messages</p>
          </div>

          <div className="mt-2 space-y-2">
            {modelRank.slice(0, 5).map((item: { name: string; value: number }) => (
              <ModelRank
                key={item.name}
                model={item}
                assistantMessages={stats.messages.assistant}
              />
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold">Thread Content Rank</h2>
          <div className="mt-4 flex text-gray-500">
            <p className="w-2/3">Thread</p>
            <p className="w-1/3 text-right">Messages</p>
          </div>

          <div className="mt-2 flex flex-col gap-2">
            {threadRank
              .slice(0, 5)
              .map((item: { id: Id<"threads">; name: string; value: number }) => (
                <Link to="/threads/$threadId" params={{ threadId: toUUID(item.id) }} key={item.id}>
                  <div className="flex h-10 justify-between gap-4 rounded-md border px-4 py-2 hover:bg-card">
                    <p className="truncate">{item.name}</p>
                    <span>{item.value}</span>
                  </div>
                </Link>
              ))}
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-semibold">AI Profile Usage Rank</h2>
        <div className="mt-4 flex text-gray-500">
          <p className="w-2/3">AI Profile</p>
          <p className="w-1/3 text-right">Assistant Messages</p>
        </div>

        <div className="mt-2 flex flex-col gap-2">
          {aiProfileRank?.slice(0, 5)?.map((item: { name: string; value: number }) => (
            <div
              key={item.name}
              className="flex h-10 justify-between gap-4 rounded-md border px-4 py-2 hover:bg-card"
            >
              <p className="truncate">{item.name}</p>
              <span>{item.value}</span>
            </div>
          ))}

          {(!aiProfileRank || aiProfileRank.length === 0) && (
            <div className="text-sm text-muted-foreground">No AI profile usage yet.</div>
          )}
        </div>
      </div>
    </main>
  );
}

function CalendarTooltip({ day, value, color }: CalendarTooltipProps) {
  return (
    <Card className="rounded-md p-1 px-0 text-sm">
      <CardContent className="flex items-center justify-center gap-2">
        <div className="size-4 shrink-0" style={{ backgroundColor: color }} />
        <span className="w-max">
          {day}: {value} {Number(value) === 1 ? "Message" : "Messages"}
        </span>
      </CardContent>
    </Card>
  );
}

function ModelRank({
  model,
  assistantMessages,
}: {
  model: { name: string; value: number };
  assistantMessages: number;
}) {
  const modelData = getModelData(model.name);
  const percentage = (model.value / assistantMessages) * 100;

  return (
    <div className="relative flex h-10 justify-between gap-4 overflow-hidden rounded-md border px-4 py-2 hover:bg-card">
      <div
        className="absolute top-0 left-0 h-full rounded-md bg-sidebar-primary/60"
        style={{ width: `${percentage}%` }}
      />

      <div className="z-10 flex items-center gap-2">
        <Icons.provider provider={modelData.provider} />
        <p>{modelData.display.name}</p>
      </div>

      <p>{model.value}</p>
    </div>
  );
}
