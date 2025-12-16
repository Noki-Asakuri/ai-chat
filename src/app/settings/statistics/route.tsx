import { api } from "@/convex/_generated/api";

import { convexQuery } from "@convex-dev/react-query";

import { ResponsiveCalendar, type CalendarTooltipProps } from "@nivo/calendar";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { LoadingStatisticsSkeleton } from "./-pending";

import { getModelData } from "@/lib/chat/models";
import { convexSessionQuery } from "@/lib/convex/helpers";
import { format } from "@/lib/utils";

export const Route = createFileRoute("/settings/statistics")({
  component: StatisticsPage,
  pendingComponent: LoadingStatisticsSkeleton,
  head: () => ({ meta: [{ title: "Statistics - AI Chat" }] }),
});

type RankItem = {
  name: string;
  value: number;
};

function StatisticsPage() {
  const statistics = useSuspenseQuery(convexSessionQuery(api.functions.statistics.getStatistics));
  const thisYear = new Date(Date.now());

  const { stats, modelRank, threadRank, activity, aiProfileRank } = statistics.data!;

  const totalMessages = stats.messages.user + stats.messages.assistant;

  const tokensTotal = stats.tokens?.total ?? 0;
  const userTokens = stats.tokensByRole?.user ?? 0;
  const assistantTokens = stats.tokensByRole?.assistant ?? 0;

  let activityTotal = 0;
  let activityPeak = 0;
  for (const point of activity) {
    activityTotal += point.value;
    if (point.value > activityPeak) activityPeak = point.value;
  }

  const modelChartData: Array<RankItem> = [];
  for (const item of modelRank.slice(0, 5)) {
    const model = getModelData(item.name);
    modelChartData.push({ name: model.display.name, value: item.value });
  }

  const threadChartData: Array<RankItem> = [];
  for (const item of threadRank.slice(0, 5)) {
    threadChartData.push({ name: item.name, value: item.value });
  }

  const profileChartData: Array<RankItem> = [];
  for (const item of aiProfileRank.slice(0, 5)) {
    profileChartData.push({ name: item.name, value: item.value });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-normal text-muted-foreground">Threads</CardTitle>
          </CardHeader>

          <CardContent>
            <div className="text-3xl font-bold">{format.number(stats.threads)}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Total messages: {format.number(totalMessages)}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-normal text-muted-foreground">Assistant</CardTitle>
          </CardHeader>

          <CardContent>
            <div className="text-3xl font-bold">{format.number(stats.messages.assistant)}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Output + reasoning: {format.number(assistantTokens)} tokens
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-normal text-muted-foreground">User</CardTitle>
          </CardHeader>

          <CardContent>
            <div className="text-3xl font-bold">{format.number(stats.messages.user)}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Input (deduped): {format.number(userTokens)} tokens
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-md">
        <CardHeader>
          <CardTitle>Activity in {thisYear.getFullYear()}</CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="h-60 px-10">
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
                background: "var(--card)",
                text: { fill: "var(--foreground)" },
              }}
              tooltip={CalendarTooltip}
            />
          </div>

          <div className="flex flex-col justify-between gap-2 md:flex-row md:items-center">
            <p className="text-sm text-muted-foreground">
              {activityTotal === 0 ? (
                <>No user messages tracked yet this year.</>
              ) : (
                <>
                  A total of {format.number(activityTotal)} user messages sent in{" "}
                  {thisYear.getFullYear()} with a peak of {format.number(activityPeak)} messages on
                  a single day.
                </>
              )}
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

          <div className="text-xs text-muted-foreground">
            Total tokens: {format.number(tokensTotal)}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4">
        <RankBarChart
          title="Model token usage"
          valueLabel="Tokens"
          color="var(--chart-1)"
          data={modelChartData}
          emptyText="No model usage yet."
        />

        <RankBarChart
          title="Thread token usage"
          valueLabel="Tokens"
          color="var(--chart-2)"
          data={threadChartData}
          emptyText="No thread activity yet."
        />

        <RankBarChart
          title="AI profile token usage"
          valueLabel="Tokens"
          color="var(--chart-3)"
          data={profileChartData}
          emptyText="No AI profile usage yet."
        />
      </div>
    </div>
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

function RankBarChart(props: {
  title: string;
  valueLabel: string;
  color: string;
  data: Array<RankItem>;
  emptyText: string;
}) {
  const chartConfig = {
    value: {
      label: props.valueLabel,
      color: props.color,
    },
  } satisfies ChartConfig;

  return (
    <Card className="rounded-md">
      <CardHeader>
        <CardTitle>{props.title}</CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {props.data.length === 0 ? (
          <div className="text-sm text-muted-foreground">{props.emptyText}</div>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-55 w-full">
            <BarChart accessibilityLayer data={props.data} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid vertical={false} />
              <YAxis
                dataKey="name"
                type="category"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                width={200}
              />
              <XAxis type="number" tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="value" fill="var(--color-value)" radius={4} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
