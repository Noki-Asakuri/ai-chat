import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Provider } from "@/lib/chat/models";

import { ResponsiveCalendar, type CalendarTooltipProps } from "@nivo/calendar";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Cell, Pie, PieChart, type TooltipProps } from "recharts";

import { Icons } from "@/components/ui/icons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
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

type PieChartItem = RankItem & {
  color: string;
  percentage: number;
};

const percentageFormat = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function getColorForName(name: string): string {
  let hash = 0;
  for (const char of name) {
    hash = (hash * 31 + char.charCodeAt(0)) % 360;
  }

  const hue = hash;
  const saturation = 68 + (hash % 10);
  const lightness = 54 + (hash % 8);
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

function StatisticsPage() {
  const currentYear = new Date().getUTCFullYear();
  const [selectedYearValue, setSelectedYearValue] = useState(String(currentYear));
  const selectedYear = Number.isFinite(Number(selectedYearValue))
    ? Number(selectedYearValue)
    : currentYear;

  const statistics = useSuspenseQuery(
    convexSessionQuery(api.functions.statistics.getStatistics, { year: selectedYear }),
  );

  const {
    threadsCount,
    userMessagesCount,
    assistantMessagesCount,
    inputTokens,
    outputTokens,
    reasoningTokens,
    modelRank,
    activity,
    aiProfileRank,
  } = statistics.data;
  const totalMessages = userMessagesCount + assistantMessagesCount;

  const tokensTotal = inputTokens + outputTokens + reasoningTokens;
  const userTokens = inputTokens;
  const assistantTokens = outputTokens + reasoningTokens;

  const availableYears = getAvailableYears(activity);
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
            <div className="text-3xl font-bold">{format.number(threadsCount)}</div>
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
            <div className="text-3xl font-bold">{format.number(assistantMessagesCount)}</div>
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
            <div className="text-3xl font-bold">{format.number(userMessagesCount)}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Input: {format.number(userTokens)} tokens
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
  return Number.isFinite(year) ? year : new Date().getUTCFullYear();
}

function getAvailableYears(activity: Array<{ day: string; value: number }>): number[] {
  const years = new Set<number>();
  for (const point of activity) {
    years.add(getYearFromDay(point.day));
  }

  years.add(new Date().getUTCFullYear());
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
  const chartData = createPieChartData(props.data);
  const chartConfig = createPieChartConfig(chartData, props.valueLabel);

  return (
    <Card className="rounded-md">
      <CardHeader>
        <CardTitle>{props.title}</CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {chartData.length === 0 ? (
          <div className="text-sm text-muted-foreground">{props.emptyText}</div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-center">
            <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full">
              <PieChart>
                <ChartTooltip content={<PieTooltipContent valueLabel={props.valueLabel} />} />
                <Pie data={chartData} dataKey="value" nameKey="name" outerRadius={122}>
                  {chartData.map((item) => (
                    <Cell key={item.name} fill={item.color} stroke="var(--card)" strokeWidth={2} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>

            <div className="space-y-3">
              {chartData.map((item) => (
                <div key={item.name} className="flex items-center gap-2 text-sm">
                  <div
                    className="size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  {item.provider ? (
                    <Icons.provider provider={item.provider} className="size-3.5 shrink-0" />
                  ) : null}
                  <span className="min-w-0 text-muted-foreground">
                    {item.name} ({format.number(item.value)} req -{" "}
                    {percentageFormat.format(item.percentage)}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function createPieChartData(data: Array<RankItem>): Array<PieChartItem> {
  let total = 0;
  for (const item of data) {
    total += item.value;
  }

  const chartData: Array<PieChartItem> = [];
  for (const item of data) {
    chartData.push({
      ...item,
      color: getColorForName(item.name),
      percentage: total === 0 ? 0 : (item.value / total) * 100,
    });
  }

  return chartData;
}

function PieTooltipContent(
  props: TooltipProps<number, string> & {
    valueLabel: string;
  },
) {
  if (!props.active || !props.payload?.length) return null;

  const payload = props.payload[0]?.payload;
  if (!isPieChartItem(payload)) return null;

  return (
    <Card className="rounded-md border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <CardContent className="flex min-w-[12rem] items-center justify-between gap-3 p-0">
        <span className="flex items-center gap-2 text-muted-foreground">
          <div
            className="size-3 shrink-0 rounded-full"
            style={{ backgroundColor: payload.color }}
          />
          {payload.provider ? (
            <Icons.provider provider={payload.provider} className="size-3.5 shrink-0" />
          ) : null}
          <span>{payload.name}</span>
        </span>
        <span className="font-mono font-medium text-foreground tabular-nums">
          {format.number(payload.value)} req - {percentageFormat.format(payload.percentage)}%
        </span>
      </CardContent>
    </Card>
  );
}

function createPieChartConfig(data: Array<PieChartItem>, valueLabel: string): ChartConfig {
  const config: ChartConfig = {
    value: {
      label: valueLabel,
      color: getColorForName(valueLabel),
    },
  };

  for (const item of data) {
    config[item.name] = {
      label: item.name,
      color: item.color,
    };
  }

  return config;
}

function isPieChartItem(value: unknown): value is PieChartItem {
  if (typeof value !== "object" || value === null) return false;
  if (
    !("name" in value) ||
    !("value" in value) ||
    !("color" in value) ||
    !("percentage" in value)
  ) {
    return false;
  }
  if (typeof value.name !== "string") return false;
  if (typeof value.value !== "number") return false;
  if (typeof value.color !== "string") return false;
  if (typeof value.percentage !== "number") return false;

  const provider = "provider" in value ? value.provider : undefined;

  return (
    provider === undefined ||
    provider === "google" ||
    provider === "openai" ||
    provider === "deepseek"
  );
}
