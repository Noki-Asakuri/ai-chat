import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { format } from "@/lib/utils";

import {
  formatCompact,
  getEntities,
  periodLabel,
  periodTokens,
  type Dimension,
  type Entity,
  type Metric,
  type Statistics,
} from "./-statistics-data";

const percent = new Intl.NumberFormat("en", { style: "percent", maximumFractionDigits: 0 });
const VISIBLE_ROWS = 6;

export function Breakdown({
  data,
  metric,
  periodName,
  focusIndex,
  onFocusChange,
}: {
  data: Statistics;
  metric: Metric;
  periodName: string;
  focusIndex: number | null;
  onFocusChange: (index: number | null) => void;
}) {
  const periods = data.activity;
  const focused = focusIndex === null ? undefined : periods[focusIndex];
  const total =
    metric === "tokens"
      ? focused
        ? periodTokens(focused)
        : data.totals.inputTokens + data.totals.outputTokens
      : (focused ?? data.totals).assistantMessagesCount;
  const unit = metric === "tokens" ? "tokens" : total === 1 ? "AI response" : "AI responses";
  const last = periods.length - 1;
  const step = (direction: -1 | 1) => {
    if (focusIndex === null) onFocusChange(direction === 1 ? 0 : last);
    else onFocusChange(Math.min(last, Math.max(0, focusIndex + direction)));
  };
  const periodUnit = data.activity[0]?.period.length === 4 ? "year" : "month";

  return (
    <section aria-labelledby="breakdown-heading" className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 id="breakdown-heading" className="text-xl font-semibold tracking-tight">
            {focused ? periodLabel(focused.period, true) : periodName}
          </h2>
          <p className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
            {metric === "tokens" ? formatCompact(total) : format.number(total)} {unit}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Previous ${periodUnit}`}
            disabled={focusIndex === 0 || periods.length === 0}
            onClick={() => step(-1)}
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Next ${periodUnit}`}
            disabled={focusIndex === last || periods.length === 0}
            onClick={() => step(1)}
          >
            <ChevronRightIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Show all of ${periodName}`}
            disabled={focusIndex === null}
            onClick={() => onFocusChange(null)}
          >
            <XIcon />
          </Button>
        </div>
      </div>
      <div className="grid min-w-0 gap-8 md:grid-cols-2 xl:grid-cols-3">
        <RankingColumn title="Models" dimension="model" data={data} metric={metric} focusIndex={focusIndex} />
        <RankingColumn
          title="Providers"
          dimension="provider"
          data={data}
          metric={metric}
          focusIndex={focusIndex}
        />
        <RankingColumn
          title="AI profiles"
          dimension="profile"
          data={data}
          metric={metric}
          focusIndex={focusIndex}
        />
      </div>
    </section>
  );
}

function RankingColumn({
  title,
  dimension,
  data,
  metric,
  focusIndex,
}: {
  title: string;
  dimension: Dimension;
  data: Statistics;
  metric: Metric;
  focusIndex: number | null;
}) {
  const [showAll, setShowAll] = useState(false);
  const recorded = getEntities(data, dimension, metric);
  // Profile tokens aren't recorded, so profiles always rank by responses.
  const entities = recorded ?? getEntities(data, dimension, "messages") ?? [];
  const valueOf = (entity: Entity) => (focusIndex === null ? entity.total : (entity.values[focusIndex] ?? 0));
  const ranked = entities.filter((entity) => valueOf(entity) > 0).toSorted((a, b) => valueOf(b) - valueOf(a));
  const columnTotal = ranked.reduce((sum, entity) => sum + valueOf(entity), 0);
  const headingId = `${dimension}-breakdown-heading`;

  return (
    <section aria-labelledby={headingId} className="flex min-w-0 flex-col gap-3 border-t pt-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 id={headingId} className="text-sm font-semibold">
          {title}
        </h3>
        {recorded === null && <span className="text-xs text-muted-foreground">By AI responses</span>}
      </div>
      {ranked.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">
          {metric === "tokens" ? "No reported tokens" : "No responses"}
          {focusIndex === null ? "." : " in this period."}
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {(showAll ? ranked : ranked.slice(0, VISIBLE_ROWS)).map((entity) => {
            const value = valueOf(entity);
            const share = value / columnTotal;
            const showTokens = metric === "tokens" && recorded !== null;
            return (
              <li
                key={entity.id}
                className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-x-3 py-1.5"
              >
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span className="flex min-w-0 items-center gap-2 text-sm">
                    <span
                      aria-hidden="true"
                      className="size-2.5 shrink-0 rounded-xs"
                      style={{ backgroundColor: entity.color }}
                    />
                    {entity.provider && dimension === "provider" && (
                      <Icons.provider provider={entity.provider} className="size-3.5 shrink-0" />
                    )}
                    <span className="truncate" title={entity.name}>
                      {entity.name}
                    </span>
                  </span>
                  <span aria-hidden="true" className="ml-4.5 h-0.5 rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${Math.max(share * 100, 1)}%`, backgroundColor: entity.color }}
                    />
                  </span>
                </div>
                <Sparkline values={entity.values} color={entity.color} focusIndex={focusIndex} />
                <span className="text-right text-sm font-medium tabular-nums" title={format.number(value)}>
                  {showTokens ? formatCompact(value) : format.number(value)}
                </span>
                <span className="w-9 text-right text-xs text-muted-foreground tabular-nums">
                  {share < 0.01 ? "<1%" : percent.format(share)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {ranked.length > VISIBLE_ROWS && (
        <Button variant="ghost" size="sm" className="self-start" onClick={() => setShowAll(!showAll)}>
          {showAll ? "Show fewer" : `Show all ${ranked.length}`}
        </Button>
      )}
    </section>
  );
}

function Sparkline({
  values,
  color,
  focusIndex,
}: {
  values: number[];
  color: string;
  focusIndex: number | null;
}) {
  const width = 56;
  const height = 18;
  if (values.length < 2) return <span className="w-14" />;
  const max = Math.max(...values, 1);
  const x = (index: number) => (index / (values.length - 1)) * (width - 4) + 2;
  const y = (value: number) => height - 2 - (value / max) * (height - 4);
  const focusValue = focusIndex === null ? undefined : values[focusIndex];
  return (
    <svg
      aria-hidden="true"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
    >
      <polyline
        points={values.map((value, index) => `${x(index)},${y(value)}`).join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {focusValue !== undefined && focusIndex !== null && (
        <circle
          cx={x(focusIndex)}
          cy={y(focusValue)}
          r={2.5}
          fill={color}
          stroke="var(--background)"
          strokeWidth={1}
        />
      )}
    </svg>
  );
}
