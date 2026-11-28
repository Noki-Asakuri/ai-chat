import { api } from "@ai-chat/backend/convex/_generated/api";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useState } from "react";
import { z } from "zod/v4";

import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";

import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { convexQuery } from "@convex-dev/react-query";
import { format } from "@/lib/utils";
import { LoadingStatisticsSkeleton } from "./-pending";
import { ActivityChart } from "./-activity-chart";
import { Breakdown } from "./-breakdown";
import { formatCompact, hasMissingTokenReports, percentChange, type Metric } from "./-statistics-data";

const changeFormat = new Intl.NumberFormat("en", { style: "percent", maximumFractionDigits: 0 });

export const Route = createFileRoute("/settings/statistics")({
  validateSearch: (search) =>
    z
      .object({
        year: z
          .union([z.literal("all"), z.number().int().min(1970).max(new Date().getUTCFullYear())])
          .optional()
          .catch(undefined),
      })
      .parse(search),
  component: StatisticsPage,
  pendingComponent: LoadingStatisticsSkeleton,
  head: () => ({ meta: [{ title: "Statistics - AI Chat" }] }),
});

function StatisticsPage() {
  return (
    <Suspense fallback={<LoadingStatisticsSkeleton />}>
      <StatisticsContent />
    </Suspense>
  );
}

const metrics = ["tokens", "messages"] as const satisfies ReadonlyArray<Metric>;
const shortMonth = new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" });

function StatisticsContent() {
  const { year = new Date().getUTCFullYear() } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data } = useSuspenseQuery(
    convexQuery(api.functions.statistics.getStatistics, {
      year: year === "all" ? undefined : year,
    }),
  );
  const [metric, setMetric] = useState<Metric>("tokens");
  const [focus, setFocus] = useState<{ year: number | "all"; index: number } | null>(null);
  const focusIndex = focus?.year === year ? focus.index : null;
  const setFocusIndex = (index: number | null) => setFocus(index === null ? null : { year, index });

  const totals = data.totals;
  const previous = data.previousTotals ?? undefined;
  const tokens = totals.inputTokens + totals.outputTokens;
  const hasActivity =
    totals.userMessagesCount + totals.assistantMessagesCount + totals.threadsCount > 0 ||
    data.dailyActivity.length > 0;
  const hasReportedTokens =
    tokens > 0 ||
    totals.assistantMessagesCount > totals.unreportedInputCount ||
    totals.assistantMessagesCount > totals.unreportedOutputCount;
  const incompleteTokens = totals.unreportedInputCount > 0 || totals.unreportedOutputCount > 0;
  const years = Array.from(new Set([...data.years, ...(year === "all" ? [] : [year])])).toSorted(
    (a, b) => b - a,
  );
  const recentYears = years.slice(0, 3);
  const olderYears = years.slice(3);
  const selectYear = (value: string) =>
    void navigate({
      search: (search) => ({ ...search, year: value === "all" ? "all" : Number(value) }),
      resetScroll: false,
    });
  const periodName = year === "all" ? "All time" : String(year);
  const lastMonth = data.activity.at(-1)?.period;
  const comparison =
    year === "all" || !previous
      ? undefined
      : lastMonth && lastMonth.slice(5) !== "12"
        ? `vs Jan–${shortMonth.format(new Date(`${lastMonth}-01T00:00:00Z`))} ${year - 1}`
        : `vs ${year - 1}`;

  return (
    <div className="flex min-w-0 flex-col gap-6 pb-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup
            value={year === "all" || recentYears.includes(year) ? [String(year)] : []}
            onValueChange={(values) => {
              if (values[0]) selectYear(values[0]);
            }}
            variant="outline"
            size="sm"
            aria-label="Statistics period"
          >
            {recentYears.map((item) => (
              <ToggleGroupItem key={item} value={String(item)}>
                {item}
              </ToggleGroupItem>
            ))}
            <ToggleGroupItem value="all">All time</ToggleGroupItem>
          </ToggleGroup>
          {olderYears.length > 0 && (
            <Select
              value={year !== "all" && olderYears.includes(year) ? String(year) : null}
              onValueChange={(value) => {
                if (value !== null) selectYear(value);
              }}
            >
              <SelectTrigger aria-label="Earlier years" size="sm" className="w-28">
                <SelectValue placeholder="Earlier">
                  {(value: string | null) => value ?? "Earlier"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {olderYears.map((item) => (
                    <SelectItem key={item} value={String(item)}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}
        </div>
        <ToggleGroup
          value={[metric]}
          onValueChange={(values) => {
            const next = metrics.find((item) => item === values[0]);
            if (next) setMetric(next);
          }}
          variant="outline"
          size="sm"
          aria-label="Measure activity by"
        >
          <ToggleGroupItem value="tokens">Tokens</ToggleGroupItem>
          <ToggleGroupItem value="messages">Messages</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {!data.historyReady && (
        <output className="text-sm text-muted-foreground">Preparing historical usage…</output>
      )}

      <section aria-label={`Totals for ${periodName}`} className="flex flex-col gap-3 border-y py-5">
        {comparison && <p className="text-xs text-muted-foreground sm:self-end">Change {comparison}</p>}
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4">
          <Kpi
            label="Tokens"
            value={
              !hasReportedTokens && totals.assistantMessagesCount > 0 ? "Unreported" : formatCompact(tokens)
            }
            fullValue={format.number(tokens)}
            change={
              // Missing reports in either span would make the change reflect reporting, not usage.
              previous && !hasMissingTokenReports(totals) && !hasMissingTokenReports(previous)
                ? percentChange(tokens, previous.inputTokens + previous.outputTokens)
                : null
            }
            detail={
              hasReportedTokens && tokens > 0
                ? `In ${formatCompact(totals.inputTokens)} · Out ${formatCompact(totals.outputTokens)}${
                    totals.reasoningTokens > 0 ? ` · Reasoning ${formatCompact(totals.reasoningTokens)}` : ""
                  }${incompleteTokens || totals.legacyResponsesCount > 0 ? " · Partial" : ""}`
                : undefined
            }
          />
          <Kpi
            label="AI responses"
            value={format.number(totals.assistantMessagesCount)}
            change={percentChange(totals.assistantMessagesCount, previous?.assistantMessagesCount)}
          />
          <Kpi
            label="Messages sent"
            value={format.number(totals.userMessagesCount)}
            change={percentChange(totals.userMessagesCount, previous?.userMessagesCount)}
          />
          <Kpi
            label="Conversations"
            value={format.number(totals.threadsCount)}
            change={percentChange(totals.threadsCount, previous?.threadsCount)}
          />
        </dl>
      </section>

      {!hasActivity ? (
        <Empty className="min-h-64">
          <EmptyHeader>
            <EmptyTitle>No activity {year === "all" ? "yet" : `in ${year}`}</EmptyTitle>
            <EmptyDescription>
              {year === "all"
                ? "Start a conversation to see your usage here."
                : "Choose another year or All time to explore your usage."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <ActivityChart
            data={data}
            year={year}
            metric={metric}
            focusIndex={focusIndex}
            onFocusChange={setFocusIndex}
          />
          {totals.assistantMessagesCount > 0 && (
            <>
              <Separator />
              <Breakdown
                data={data}
                metric={metric}
                periodName={periodName}
                focusIndex={focusIndex}
                onFocusChange={setFocusIndex}
              />
            </>
          )}
        </>
      )}
      <details className="text-xs leading-relaxed text-muted-foreground">
        <summary className="w-fit cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-ring">
          About these statistics
        </summary>
        <p className="mt-2 max-w-3xl">
          Responses include completed retries; conversations include branches. Tokens are provider-reported:
          input includes reprocessed history, and output includes reasoning. Stopped and failed responses
          aren’t included.
        </p>
        {data.historyReady && (
          <p className="mt-2 max-w-3xl">
            Historical totals were reconstructed from retained conversations; earlier deletions and replaced
            responses may be missing.
            {totals.legacyResponsesCount > 0
              ? " Older token reports are approximate and may have incomplete breakdowns."
              : ""}{" "}
            New usage remains counted when you delete a conversation.
          </p>
        )}
      </details>
    </div>
  );
}

function Kpi({
  label,
  value,
  fullValue,
  change,
  detail,
}: {
  label: string;
  value: string;
  fullValue?: string;
  change: number | null;
  detail?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd
        className="text-3xl font-semibold tracking-tight break-words tabular-nums sm:text-4xl"
        title={fullValue}
      >
        {value}
      </dd>
      {change !== null && (
        <dd className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
          {change >= 0 ? (
            <ArrowUpIcon aria-hidden="true" className="size-3" />
          ) : (
            <ArrowDownIcon aria-hidden="true" className="size-3" />
          )}
          <span className="sr-only">{change >= 0 ? "Up" : "Down"}</span>
          {changeFormat.format(Math.abs(change))}
        </dd>
      )}
      {detail && <dd className="text-xs text-muted-foreground tabular-nums">{detail}</dd>}
    </div>
  );
}
