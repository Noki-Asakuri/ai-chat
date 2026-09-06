import type { api } from "@ai-chat/backend/convex/_generated/api";

import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { format } from "@/lib/utils";

import { ActivityCalendar } from "./-activity-calendar";

const chartConfig = {
  userMessagesCount: { label: "Messages sent", color: "var(--chart-1)" },
  assistantMessagesCount: { label: "AI responses", color: "var(--chart-2)" },
  inputTokens: { label: "Input tokens", color: "var(--chart-1)" },
  outputTokens: { label: "Output tokens", color: "var(--chart-2)" },
} satisfies ChartConfig;
const compactNumber = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const monthName = new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" });

export function ActivityChart({
  data,
  year,
}: {
  data: FunctionReturnType<typeof api.functions.statistics.getStatistics>;
  year: number | "all";
}) {
  const [metric, setMetric] = useState("calendar");
  const [visibleSeries, setVisibleSeries] = useState<string[]>(() => Object.keys(chartConfig));
  const totals = data.totals;
  const hasReportedTokens =
    totals.inputTokens + totals.outputTokens > 0 ||
    totals.assistantMessagesCount > totals.unreportedInputCount ||
    totals.assistantMessagesCount > totals.unreportedOutputCount;
  const series =
    metric === "messages"
      ? (["userMessagesCount", "assistantMessagesCount"] as const)
      : (["inputTokens", "outputTokens"] as const);
  const activity = data.activity.map((point) => ({
    ...point,
    inputTokens:
      point.inputTokens === 0 &&
      point.assistantMessagesCount > 0 &&
      point.unreportedInputCount === point.assistantMessagesCount
        ? null
        : point.inputTokens,
    outputTokens:
      point.outputTokens === 0 &&
      point.assistantMessagesCount > 0 &&
      point.unreportedOutputCount === point.assistantMessagesCount
        ? null
        : point.outputTokens,
    label: year === "all" ? point.period : monthName.format(new Date(`${point.period}-01T00:00:00Z`)),
  }));
  return (
    <section aria-labelledby="activity-heading" className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="activity-heading" className="text-sm font-semibold">
            Activity
          </h2>
        </div>
        <ToggleGroup
          value={[metric]}
          onValueChange={(values) => {
            if (values[0]) setMetric(values[0]);
          }}
          variant="outline"
          size="sm"
          aria-label="Activity metric"
        >
          <ToggleGroupItem value="calendar">Calendar</ToggleGroupItem>
          <ToggleGroupItem value="messages">Messages</ToggleGroupItem>
          <ToggleGroupItem value="tokens">Tokens</ToggleGroupItem>
        </ToggleGroup>
      </div>
      {metric === "calendar" ? (
        <ActivityCalendar activity={data.dailyActivity} year={year} />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ToggleGroup
              multiple
              value={visibleSeries}
              onValueChange={setVisibleSeries}
              spacing={2}
              size="sm"
              aria-label="Visible chart series"
            >
              {series.map((key) => (
                <ToggleGroupItem
                  key={key}
                  value={key}
                  aria-label={`Show ${chartConfig[key].label.toLowerCase()}`}
                >
                  <span
                    aria-hidden="true"
                    className="size-2.5 rounded-xs"
                    style={{ backgroundColor: chartConfig[key].color }}
                  />
                  {chartConfig[key].label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <span className="text-xs text-muted-foreground">
              {year === "all" ? "Yearly" : "Monthly"} · UTC
            </span>
          </div>
          {metric === "tokens" && !hasReportedTokens ? (
            <Empty className="min-h-64">
              <EmptyHeader>
                <EmptyTitle>Token usage wasn’t reported</EmptyTitle>
                <EmptyDescription>
                  Message counts are available, but providers did not return token totals for these responses.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : !series.some((key) => visibleSeries.includes(key)) ? (
            <Empty className="min-h-64">
              <EmptyHeader>
                <EmptyTitle>Select a series to view activity</EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : (
            <ChartContainer
              config={chartConfig}
              className="aspect-auto h-48 w-full [&_.recharts-surface:focus-visible]:outline-2 [&_.recharts-surface:focus-visible]:outline-ring"
              aria-label={`${metric === "messages" ? "Messages" : "Provider token usage"} by ${year === "all" ? "year" : "month"}`}
            >
              <BarChart accessibilityLayer data={activity} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} minTickGap={16} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  allowDecimals={false}
                  tickFormatter={(value: number) => compactNumber.format(value)}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                {series.map((key) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    hide={!visibleSeries.includes(key)}
                    fill={chartConfig[key].color}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={32}
                    isAnimationActive={false}
                  />
                ))}
              </BarChart>
            </ChartContainer>
          )}
          {metric === "tokens" &&
            (totals.unreportedInputCount > 0 ||
              totals.unreportedOutputCount > 0 ||
              totals.legacyResponsesCount > 0) && (
              <p className="text-xs text-muted-foreground">
                Reported tokens only. Some responses have missing or approximate usage.
              </p>
            )}
          <details className="text-sm">
            <summary className="w-fit cursor-pointer rounded-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring">
              View activity data
            </summary>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm tabular-nums">
                <caption className="sr-only">
                  Activity totals for {year === "all" ? "all time" : year}
                </caption>
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="py-2">
                      Period
                    </th>
                    {series.map((key) => (
                      <th key={key} scope="col" className="px-3 py-2 text-right">
                        {chartConfig[key].label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activity.map((point) => (
                    <tr key={point.period} className="border-t">
                      <th scope="row" className="py-2 font-normal">
                        {point.period}
                      </th>
                      {series.map((key) => (
                        <td key={key} className="px-3 py-2 text-right">
                          {point[key] === null ? "Unreported" : format.number(point[key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
