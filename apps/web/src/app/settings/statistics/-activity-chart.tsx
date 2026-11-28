import { CalendarDaysIcon, ChartColumnStackedIcon, ChartLineIcon } from "lucide-react";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { format } from "@/lib/utils";

import { ActivityCalendar } from "./-activity-calendar";
import {
  OTHER_COLOR,
  SERIES_COLORS,
  UNATTRIBUTED_ID,
  formatCompact,
  getEntities,
  isTokenUnreported,
  periodLabel,
  type Dimension,
  type Metric,
  type Statistics,
} from "./-statistics-data";

type Group = Dimension | "split";
type View = "bars" | "lines" | "calendar";
type Series = { key: string; label: string; color: string; values: Array<number | null> };

const groupOptions = {
  tokens: [
    { value: "model", label: "Model" },
    { value: "provider", label: "Provider" },
    { value: "split", label: "In / Out" },
  ],
  messages: [
    { value: "model", label: "Model" },
    { value: "provider", label: "Provider" },
    { value: "profile", label: "Profile" },
    { value: "split", label: "Sent / Received" },
  ],
} satisfies Record<Metric, ReadonlyArray<{ value: Group; label: string }>>;
const views = ["bars", "lines", "calendar"] as const satisfies ReadonlyArray<View>;
const keyOf = (index: number) => `s${index}`;

// A period whose responses all lacked a report is "unreported", not zero.
function reported(value: number, unreported: number, responses: number) {
  return value === 0 && responses > 0 && unreported === responses ? null : value;
}

function getSeries(data: Statistics, metric: Metric, group: Group): Series[] {
  if (group === "split") {
    if (metric === "messages") {
      return [
        {
          key: "userMessagesCount",
          label: "Messages sent",
          color: SERIES_COLORS[0],
          values: data.activity.map((point) => point.userMessagesCount),
        },
        {
          key: "assistantMessagesCount",
          label: "AI responses",
          color: SERIES_COLORS[1],
          values: data.activity.map((point) => point.assistantMessagesCount),
        },
      ];
    }
    return [
      {
        key: "inputTokens",
        label: "Input tokens",
        color: SERIES_COLORS[0],
        values: data.activity.map((point) =>
          reported(point.inputTokens, point.unreportedInputCount, point.assistantMessagesCount),
        ),
      },
      {
        key: "outputTokens",
        label: "Output tokens",
        color: SERIES_COLORS[1],
        values: data.activity.map((point) =>
          reported(point.outputTokens, point.unreportedOutputCount, point.assistantMessagesCount),
        ),
      },
    ];
  }

  const entities = getEntities(data, group, metric) ?? [];
  const named = entities.filter((entity) => entity.color !== OTHER_COLOR);
  const rest = entities.filter((entity) => entity.color === OTHER_COLOR);
  // Periods whose token usage was never reported are gaps, not measured zeros.
  const value = (index: number, measured: number) =>
    metric === "tokens" && isTokenUnreported(data.activity[index]!) ? null : measured;
  const series: Series[] = named.map((entity) => ({
    key: entity.id,
    label: entity.name,
    color: entity.color,
    values: entity.values.map((measured, index) => value(index, measured)),
  }));
  if (rest.length > 0) {
    series.push({
      key: "other",
      label: rest.length === 1 && rest[0]!.id === UNATTRIBUTED_ID ? "Unattributed" : "Other",
      color: OTHER_COLOR,
      values: data.activity.map((_, index) =>
        value(
          index,
          rest.reduce((sum, entity) => sum + entity.values[index]!, 0),
        ),
      ),
    });
  }
  return series;
}

export function ActivityChart({
  data,
  year,
  metric,
  focusIndex,
  onFocusChange,
}: {
  data: Statistics;
  year: number | "all";
  metric: Metric;
  focusIndex: number | null;
  onFocusChange: (index: number | null) => void;
}) {
  const [view, setView] = useState<View>("bars");
  const [selectedGroup, setGroup] = useState<Group>("model");
  const options: ReadonlyArray<{ value: Group; label: string }> = groupOptions[metric];
  const group = options.find((option) => option.value === selectedGroup)?.value ?? "model";
  // Hidden series belong to one metric and grouping, so a fallback grouping starts fully visible.
  const scope = `${metric}:${group}`;
  const [hiddenState, setHiddenState] = useState<{ scope: string; keys: string[] }>({ scope, keys: [] });
  const hidden = hiddenState.scope === scope ? hiddenState.keys : [];
  const setHidden = (keys: string[]) => setHiddenState({ scope, keys });
  const totals = data.totals;
  const hasReportedTokens =
    totals.inputTokens + totals.outputTokens > 0 ||
    totals.assistantMessagesCount > totals.unreportedInputCount ||
    totals.assistantMessagesCount > totals.unreportedOutputCount;
  const tokensUnreported = metric === "tokens" && !hasReportedTokens;

  const series = getSeries(data, metric, group);
  // With no reported tokens the per-model series are all zero; the table shows the unreported split.
  const tableSeries = tokensUnreported ? getSeries(data, "tokens", "split") : series;
  const visible = series.filter((item) => !hidden.includes(item.key));
  const chartConfig: ChartConfig = Object.fromEntries(
    series.map((item, index) => [keyOf(index), { label: item.label, color: item.color }]),
  );
  const rows = data.activity.map((point, index) => ({
    period: point.period,
    label: periodLabel(point.period),
    ...Object.fromEntries(series.map((item, seriesIndex) => [keyOf(seriesIndex), item.values[index]])),
  }));
  const topKey = visible.at(-1)?.key;
  const unit = year === "all" ? "Yearly" : "Monthly";
  const subject = metric === "tokens" ? "Tokens" : group === "split" ? "Messages" : "AI responses";
  const groupName = options.find((option) => option.value === group)?.label.toLowerCase();
  const focusLabel = focusIndex === null ? undefined : rows[focusIndex]?.label;
  const handleClick = (state: { activeTooltipIndex?: number | string | null }) => {
    const index = Number(state.activeTooltipIndex);
    if (state.activeTooltipIndex == null || Number.isNaN(index)) return;
    onFocusChange(index === focusIndex ? null : index);
  };

  return (
    <section aria-labelledby="activity-heading" className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 id="activity-heading" className="text-base font-semibold">
            Activity
          </h2>
          <p className="text-xs text-muted-foreground">
            {view === "calendar"
              ? "Messages sent per day · UTC"
              : `${subject} by ${group === "split" ? "type" : groupName} · ${unit.toLowerCase()} · UTC`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {view !== "calendar" && (
            <ToggleGroup
              value={[group]}
              onValueChange={(values) => {
                const next = options.find((option) => option.value === values[0]);
                if (!next) return;
                setGroup(next.value);
              }}
              variant="outline"
              size="sm"
              aria-label="Group activity by"
            >
              {options.map((option) => (
                <ToggleGroupItem key={option.value} value={option.value}>
                  {option.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
          <ToggleGroup
            value={[view]}
            onValueChange={(values) => {
              const next = views.find((item) => item === values[0]);
              if (next) setView(next);
            }}
            variant="outline"
            size="sm"
            aria-label="Chart type"
          >
            <ToggleGroupItem value="bars" aria-label="Stacked bars">
              <ChartColumnStackedIcon />
            </ToggleGroupItem>
            <ToggleGroupItem value="lines" aria-label="Lines">
              <ChartLineIcon />
            </ToggleGroupItem>
            <ToggleGroupItem value="calendar" aria-label="Daily calendar">
              <CalendarDaysIcon />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {view === "calendar" ? (
        <ActivityCalendar activity={data.dailyActivity} year={year} />
      ) : (
        <>
          {tokensUnreported ? (
            <Empty className="min-h-64">
              <EmptyHeader>
                <EmptyTitle>Token usage wasn’t reported</EmptyTitle>
                <EmptyDescription>
                  Message counts are available, but providers did not return token totals for these responses.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : visible.length === 0 ? (
            <Empty className="min-h-64">
              <EmptyHeader>
                <EmptyTitle>Select a series to view activity</EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : (
            <ChartContainer
              config={chartConfig}
              className="aspect-auto h-64 w-full [&_.recharts-surface:focus-visible]:outline-2 [&_.recharts-surface:focus-visible]:outline-ring"
              aria-label={`${subject} by ${year === "all" ? "year" : "month"}. Select a bar to see its breakdown.`}
            >
              {view === "bars" ? (
                <BarChart
                  accessibilityLayer
                  data={rows}
                  margin={{ top: 8, right: 0, left: 0, bottom: 0 }}
                  onClick={handleClick}
                  className="cursor-pointer"
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} minTickGap={16} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={48}
                    allowDecimals={false}
                    tickFormatter={formatCompact}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  {series.map((item, seriesIndex) => (
                    <Bar
                      key={item.key}
                      dataKey={keyOf(seriesIndex)}
                      stackId="activity"
                      hide={hidden.includes(item.key)}
                      fill={item.color}
                      stroke="var(--background)"
                      strokeWidth={2}
                      radius={item.key === topKey ? [4, 4, 0, 0] : 0}
                      maxBarSize={48}
                      isAnimationActive={false}
                    >
                      {rows.map((row, rowIndex) => (
                        <Cell
                          key={row.period}
                          fillOpacity={focusIndex === null || focusIndex === rowIndex ? 1 : 0.35}
                        />
                      ))}
                    </Bar>
                  ))}
                </BarChart>
              ) : (
                <LineChart
                  accessibilityLayer
                  data={rows}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  onClick={handleClick}
                  className="cursor-pointer"
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} minTickGap={16} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={48}
                    allowDecimals={false}
                    tickFormatter={formatCompact}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  {focusLabel && <ReferenceLine x={focusLabel} stroke="var(--muted-foreground)" />}
                  {series.map((item, seriesIndex) => (
                    <Line
                      key={item.key}
                      dataKey={keyOf(seriesIndex)}
                      hide={hidden.includes(item.key)}
                      type="monotone"
                      stroke={item.color}
                      strokeWidth={2}
                      dot={isolatedDot(item.values, item.color)}
                      activeDot={{ r: 4 }}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              )}
            </ChartContainer>
          )}

          {!tokensUnreported && (
            <ToggleGroup
              multiple
              value={series.filter((item) => !hidden.includes(item.key)).map((item) => item.key)}
              onValueChange={(values) =>
                setHidden(series.filter((item) => !values.includes(item.key)).map((item) => item.key))
              }
              spacing={2}
              size="sm"
              aria-label="Visible chart series"
              className="flex-wrap"
            >
              {series.map((item) => (
                <ToggleGroupItem
                  key={item.key}
                  value={item.key}
                  aria-label={`Show ${item.label}`}
                  className="text-muted-foreground aria-pressed:text-foreground"
                >
                  <span
                    aria-hidden="true"
                    className="size-2.5 rounded-xs"
                    style={{ backgroundColor: item.color }}
                  />
                  {item.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
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
                  {subject} for {year === "all" ? "all time" : year}
                </caption>
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="py-2">
                      Period
                    </th>
                    {tableSeries.map((item) => (
                      <th key={item.key} scope="col" className="px-3 py-2 text-right">
                        {item.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.activity.map((point, index) => (
                    <tr key={point.period} className="border-t">
                      <th scope="row" className="py-2 font-normal">
                        {point.period}
                      </th>
                      {tableSeries.map((item) => {
                        const value = item.values[index];
                        return (
                          <td key={item.key} className="px-3 py-2 text-right">
                            {value === null || value === undefined ? "Unreported" : format.number(value)}
                          </td>
                        );
                      })}
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

/** Lines skip unreported periods, so a reported value with gaps on both sides needs a dot to be seen. */
function isolatedDot(values: Array<number | null>, color: string) {
  return function renderDot(props: { cx?: number; cy?: number; index?: number }) {
    return <IsolatedDot key={props.index} {...props} values={values} color={color} />;
  };
}

function IsolatedDot({
  cx,
  cy,
  index,
  values,
  color,
}: {
  cx?: number;
  cy?: number;
  index?: number;
  values: Array<number | null>;
  color: string;
}) {
  if (cx === undefined || cy === undefined || index === undefined || values[index] == null) return <g />;
  if (values[index - 1] != null || values[index + 1] != null) return <g />;
  return <circle cx={cx} cy={cy} r={3} fill={color} />;
}
