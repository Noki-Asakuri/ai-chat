import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Provider } from "@/lib/chat/models";

import { ResponsiveCalendar, type CalendarTooltipProps } from "@nivo/calendar";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { type ComponentType, useState } from "react";
import { Cell, Pie, PieChart } from "recharts";

import { Icons } from "@/components/ui/icons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { LoadingStatisticsSkeleton } from "./-pending";

import { tryGetModelData } from "@/lib/chat/models";
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
  provider?: Provider;
};

const PIE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function StatisticsPage() {
  const statistics = useSuspenseQuery(convexSessionQuery(api.functions.statistics.getStatistics));

  const { stats, modelRank, activity, aiProfileRank } = statistics.data!;
  const totalMessages = stats.messages.user + stats.messages.assistant;

  const tokensTotal = stats.tokens?.total ?? 0;
  const userTokens = stats.tokensByRole?.user ?? 0;
  const assistantTokens = stats.tokensByRole?.assistant ?? 0;

  const availableYears = getAvailableYears(activity);
  const defaultYear = availableYears[0] ?? new Date().getFullYear();
  const [selectedYearValue, setSelectedYearValue] = useState(String(defaultYear));
  const selectedYear = availableYears.includes(Number(selectedYearValue))
    ? Number(selectedYearValue)
    : defaultYear;
  const selectedYearActivity = activity.filter(
    (point) => getYearFromDay(point.day) === selectedYear,
  );

  let activityTotal = 0;
  let activityPeak = 0;
  for (const point of selectedYearActivity) {
    activityTotal += point.value;
    if (point.value > activityPeak) activityPeak = point.value;
  }

  const modelChartData: Array<RankItem> = [];
  for (const item of modelRank.slice(0, 5)) {
    const model = tryGetModelData(item.name);
    modelChartData.push({
      name: model?.display.name ?? item.name,
      value: item.value,
      provider: model?.provider,
    });
  }

  const profileChartData: Array<RankItem> = [];
  for (const item of aiProfileRank.slice(0, 5)) {
    profileChartData.push({ name: item.name, value: item.value });
  }

  const startOfYear = `${selectedYear}-01-01`;
  const endOfYear = `${selectedYear}-12-31`;

  function handleYearChange(value: string | null) {
    if (!value) return;
    setSelectedYearValue(value);
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
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Activity in {selectedYear}</CardTitle>

          <Select value={String(selectedYear)} onValueChange={(value) => handleYearChange(value)}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue>{selectedYear}</SelectValue>
            </SelectTrigger>

            <SelectContent className="bg-card">
              {availableYears.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="h-60 px-4 sm:px-10">
            <ResponsiveCalendar
              data={selectedYearActivity}
              from={startOfYear}
              to={endOfYear}
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
                <>No user messages tracked yet for {selectedYear}.</>
              ) : (
                <>
                  A total of {format.number(activityTotal)} user messages were sent in{" "}
                  {selectedYear}, with a peak of {format.number(activityPeak)} messages on a single
                  day.
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

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <RankPieChart
          title="Model request usage"
          valueLabel="Requests"
          data={modelChartData}
          emptyText="No model usage yet."
        />

        <RankPieChart
          title="AI profile request usage"
          valueLabel="Requests"
          data={profileChartData}
          emptyText="No AI profile usage yet."
        />
      </div>
    </div>
  );
}

function getYearFromDay(day: string): number {
  const year = Number(day.slice(0, 4));
  return Number.isFinite(year) ? year : new Date().getFullYear();
}

function getAvailableYears(activity: Array<{ day: string; value: number }>): number[] {
  const years = new Set<number>();
  for (const point of activity) {
    years.add(getYearFromDay(point.day));
  }

  if (years.size === 0) years.add(new Date().getFullYear());
  return Array.from(years).sort((a, b) => b - a);
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

function RankPieChart(props: {
  title: string;
  valueLabel: string;
  data: Array<RankItem>;
  emptyText: string;
}) {
  const chartConfig = createPieChartConfig(props.data, props.valueLabel);

  return (
    <Card className="rounded-md">
      <CardHeader>
        <CardTitle>{props.title}</CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {props.data.length === 0 ? (
          <div className="text-sm text-muted-foreground">{props.emptyText}</div>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full">
            <PieChart>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    nameKey="name"
                    formatter={(value, name, _item, _index, payload) => (
                      <div className="flex w-full items-center justify-between gap-3">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          {hasProvider(payload) && payload.provider ? (
                            <Icons.provider
                              provider={payload.provider}
                              className="size-3.5 shrink-0"
                            />
                          ) : null}
                          <span>{name}</span>
                        </span>
                        <span className="font-mono font-medium text-foreground tabular-nums">
                          {format.number(Number(value))} {props.valueLabel}
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <Pie
                data={props.data}
                dataKey="value"
                nameKey="name"
                innerRadius={70}
                outerRadius={105}
              >
                {props.data.map((item, index) => (
                  <Cell key={item.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey="name" className="flex-wrap" />} />
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

function createPieChartConfig(data: Array<RankItem>, valueLabel: string): ChartConfig {
  const config: ChartConfig = {
    value: {
      label: valueLabel,
      color: PIE_COLORS[0],
    },
  };

  for (const [index, item] of data.entries()) {
    config[item.name] = {
      label: item.name,
      color: PIE_COLORS[index % PIE_COLORS.length],
      ...(getProviderIcon(item.provider) ? { icon: getProviderIcon(item.provider) } : {}),
    };
  }

  return config;
}

function getProviderIcon(provider?: Provider): ComponentType | undefined {
  if (!provider) return undefined;

  return function ProviderIcon() {
    return <Icons.provider provider={provider} className="size-3.5 shrink-0" />;
  };
}

function hasProvider(value: unknown): value is { provider?: Provider } {
  if (typeof value !== "object" || value === null) return false;
  if (!("provider" in value)) return false;

  return (
    value.provider === undefined ||
    value.provider === "google" ||
    value.provider === "openai" ||
    value.provider === "deepseek"
  );
}
