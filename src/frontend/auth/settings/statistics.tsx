import { ResponsiveCalendar, type CalendarTooltipProps } from "@nivo/calendar";
import { api } from "convex/_generated/api";
import { useQuery } from "convex/react";

import { NavLink } from "react-router";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icons } from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/skeleton";

import { getModelData } from "@/lib/chat/models";
import { format, toUUID } from "@/lib/utils";

type StatisticsData = {
  stats: { name: string; value: number }[];
  modelRank: { name: string; value: number }[];
  threadRank: { id: string; name: string; value: number }[];
  activity: { day: string; value: number }[];
};

export function StatisticsPage() {
  const statistics = useQuery(api.statistics.getStatistics) as StatisticsData | undefined;
  const thisYear = new Date(Date.now());

  if (!statistics) {
    return (
      <main className="space-y-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-12" />
              </CardHeader>

              <CardContent>
                <Skeleton className="h-8 w-16" />
                <Skeleton className="mt-1 h-4 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-1 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-6 w-40" />
              <div className="mt-4 flex text-gray-500">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
              </div>
              <div className="mt-2 space-y-2">
                {Array.from({ length: 5 }).map((_, j) => (
                  <div key={j} className="flex justify-between">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/4" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    );
  }

  const { stats, modelRank, threadRank, activity } = statistics;
  const totalMessages = stats.find((s) => s.name === "Messages")?.value ?? 0;

  return (
    <main className="space-y-8">
      <div className="grid grid-cols-3 gap-2">
        {stats.map((item) => (
          <Card key={item.name} className="rounded-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-normal text-gray-400">{item.name}</CardTitle>
            </CardHeader>

            <CardContent>
              <div className="text-3xl font-bold">{format.number(item.value)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <div className="flex justify-between">
          <h2 className="text-xl font-semibold">Activity in the {thisYear.getFullYear()}</h2>
        </div>
        <div className="mt-4 h-42">
          <ResponsiveCalendar
            data={activity}
            from={new Date(thisYear.setFullYear(thisYear.getFullYear())).toISOString()}
            to={thisYear}
            colors={["#0e4429", "#006d32", "#26a641", "#39d353"]}
            emptyColor="#151b23"
            daySpacing={2}
            tooltip={CalenderTooltip}
          />
        </div>

        <div className="mt-2 flex justify-between">
          <p className="text-sm">
            A total of {format.number(totalMessages)} messages sent in the {thisYear.getFullYear()}
          </p>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <p>Inactive</p>
            <div className="size-4 rounded-xs" style={{ backgroundColor: "#151b23" }} />
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
            {modelRank.slice(0, 5).map((item) => (
              <ModelRank key={item.name} model={item} />
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold">Thread Content Rank</h2>
          <div className="mt-4 flex text-gray-500">
            <p className="w-2/3">Thread</p>
            <p className="w-1/3 text-right">Messages</p>
          </div>

          <div className="mt-2 space-y-2">
            {threadRank.slice(0, 5).map((item) => (
              <NavLink to={`/chat/${toUUID(item.id)}`} key={item.id}>
                <div className="hover:bg-card flex justify-between gap-4 rounded-md px-4 py-2">
                  <p className="truncate">{item.name}</p>
                  <span>{item.value}</span>
                </div>
              </NavLink>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

function CalenderTooltip({ day, value, color }: CalendarTooltipProps) {
  return (
    <Card className="rounded-md p-1 px-0 text-sm">
      <CardContent className="flex items-center justify-center gap-2">
        <div className="size-4 shrink-0" style={{ backgroundColor: color }} />
        <span className="w-max">
          {day}: {value} Message
        </span>
      </CardContent>
    </Card>
  );
}

function ModelRank({ model }: { model: { name: string; value: number } }) {
  const modelData = getModelData(model.name);

  return (
    <div className="hover:bg-card flex justify-between gap-4 rounded-md px-4 py-2">
      <div className="flex items-center gap-2">
        <Icons.provider provider={modelData.provider} />
        <p>{modelData.displayName}</p>
      </div>

      <p>{model.value}</p>
    </div>
  );
}
