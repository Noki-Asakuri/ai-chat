import { api } from "@ai-chat/backend/convex/_generated/api";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useState } from "react";
import { z } from "zod/v4";

import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { tryGetModelData, type Provider } from "@/lib/chat/models";
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
import { convexSessionQuery } from "@/lib/convex/helpers";
import { format } from "@/lib/utils";
import { LoadingStatisticsSkeleton } from "./-pending";
import { ActivityChart } from "./-activity-chart";

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

const percentNumber = new Intl.NumberFormat("en", { style: "percent", maximumFractionDigits: 1 });
function StatisticsPage() {
  return (
    <Suspense fallback={<LoadingStatisticsSkeleton />}>
      <StatisticsContent />
    </Suspense>
  );
}

function StatisticsContent() {
  const { year = new Date().getUTCFullYear() } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data } = useSuspenseQuery(
    convexSessionQuery(api.functions.statistics.getStatistics, {
      year: year === "all" ? undefined : year,
    }),
  );
  const totals = data.totals;
  const tokens = totals.inputTokens + totals.outputTokens;
  const hasActivity =
    totals.userMessagesCount + totals.assistantMessagesCount + totals.threadsCount > 0 ||
    data.dailyActivity.length > 0;
  const hasReportedTokens =
    tokens > 0 ||
    totals.assistantMessagesCount > totals.unreportedInputCount ||
    totals.assistantMessagesCount > totals.unreportedOutputCount;
  const incompleteTokens = totals.unreportedInputCount > 0 || totals.unreportedOutputCount > 0;
  const tokenLabel =
    !hasReportedTokens && totals.assistantMessagesCount > 0 ? "Unreported" : format.number(tokens);
  const years = Array.from(new Set([...data.years, ...(year === "all" ? [] : [year])])).toSorted(
    (a, b) => b - a,
  );

  return (
    <div className="flex min-w-0 flex-col gap-4 pb-2">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {year === "all" ? "Your usage across all years" : `Your usage in ${year}`}
        </p>
        <Select
          value={String(year)}
          onValueChange={(value) => {
            if (value === null) return;
            void navigate({
              search: (previous) => ({ ...previous, year: value === "all" ? "all" : Number(value) }),
              resetScroll: false,
            });
          }}
        >
          <SelectTrigger aria-label="Statistics period" className="w-36">
            <SelectValue>{year === "all" ? "All time" : year}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">All time</SelectItem>
              {years.map((item) => (
                <SelectItem key={item} value={String(item)}>
                  {item}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {!data.historyReady && (
        <output className="text-sm text-muted-foreground">Preparing historical usage…</output>
      )}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-y py-3 lg:grid-cols-4">
        <Summary label="Messages sent" value={format.number(totals.userMessagesCount)} />
        <Summary label="AI responses" value={format.number(totals.assistantMessagesCount)} />
        <Summary label="Conversations started" value={format.number(totals.threadsCount)} />
        <Summary
          label="Tokens processed"
          value={tokenLabel}
          detail={incompleteTokens || totals.legacyResponsesCount > 0 ? "Partial / approximate" : undefined}
        />
      </dl>

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
          <ActivityChart data={data} year={year} />
          {totals.assistantMessagesCount > 0 && (
            <>
              <Separator />
              <section aria-labelledby="tokens-heading" className="flex flex-col gap-2">
                <h2 id="tokens-heading" className="text-sm font-semibold">
                  Token usage
                </h2>
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <TokenDetail
                    label="Input"
                    value={totals.inputTokens}
                    unreported={totals.unreportedInputCount}
                    responses={totals.assistantMessagesCount}
                  />
                  <TokenDetail
                    label="Output"
                    value={totals.outputTokens}
                    unreported={totals.unreportedOutputCount}
                    responses={totals.assistantMessagesCount}
                  />
                  {totals.reasoningTokens > 0 && (
                    <div>
                      <dt className="text-sm text-muted-foreground">Reasoning</dt>
                      <dd className="mt-1 font-medium tabular-nums">
                        {format.number(totals.reasoningTokens)}{" "}
                        <span className="text-xs font-normal text-muted-foreground">included in output</span>
                      </dd>
                    </div>
                  )}
                </dl>
              </section>
              <Separator />
              <div className="grid min-w-0 gap-5 md:grid-cols-2 md:gap-8">
                <UsageRanking
                  title="Models"
                  items={data.modelRank.map((item) => ({
                    ...item,
                    provider: tryGetModelData(item.id)?.provider,
                  }))}
                  total={totals.assistantMessagesCount}
                  tokenTotal={tokens}
                />
                <UsageRanking
                  title="AI profiles"
                  items={data.aiProfileRank}
                  total={totals.assistantMessagesCount}
                />
              </div>
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

function Summary({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tracking-tight break-words tabular-nums sm:text-2xl">
        {value}
      </dd>
      {detail && <dd className="mt-1 text-xs text-muted-foreground">{detail}</dd>}
    </div>
  );
}

function TokenDetail({
  label,
  value,
  unreported,
  responses,
}: {
  label: string;
  value: number;
  unreported: number;
  responses: number;
}) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium tabular-nums">
        {unreported === responses && value === 0 ? "Unreported" : format.number(value)}
      </dd>
      {unreported > 0 && (
        <dd className="mt-1 text-xs text-muted-foreground">
          Incomplete for {format.number(unreported)} {unreported === 1 ? "response" : "responses"}
        </dd>
      )}
    </div>
  );
}

function UsageRanking({
  title,
  items,
  total,
  tokenTotal,
}: {
  title: string;
  items: Array<{ id: string; name: string; value: number; provider?: Provider; tokens?: number }>;
  total: number;
  tokenTotal?: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const [metric, setMetric] = useState("responses");
  const rankedItems =
    metric === "tokens"
      ? items
          .map((item) => ({ ...item, value: item.tokens ?? 0 }))
          .filter((item) => item.value > 0)
          .toSorted((a, b) => b.value - a.value)
      : items;
  const rankedTotal = metric === "tokens" ? rankedItems.reduce((sum, item) => sum + item.value, 0) : total;
  const headingId = title === "Models" ? "models-heading" : "profiles-heading";
  return (
    <section aria-labelledby={headingId} className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={headingId} className="text-sm font-semibold">
          {title}
        </h2>
        {tokenTotal !== undefined && (
          <ToggleGroup
            value={[metric]}
            onValueChange={(values) => {
              if (values[0]) setMetric(values[0]);
            }}
            variant="outline"
            size="sm"
            aria-label="Model ranking metric"
          >
            <ToggleGroupItem value="responses">Responses</ToggleGroupItem>
            <ToggleGroupItem value="tokens">Tokens</ToggleGroupItem>
          </ToggleGroup>
        )}
      </div>
      {metric === "tokens" && (
        <p className="text-xs text-muted-foreground">
          {rankedTotal === 0
            ? "No reported model tokens."
            : tokenTotal !== undefined && rankedTotal < tokenTotal
              ? "Reported tokens · some historical usage is unattributed"
              : "Reported tokens · input + output"}
        </p>
      )}
      <ul className="flex flex-col gap-3">
        {(showAll ? rankedItems : rankedItems.slice(0, 5)).map((item) => (
          <li key={item.id} className="flex min-w-0 flex-col gap-2">
            <div className="flex items-baseline justify-between gap-4">
              <span className="flex min-w-0 items-center gap-2 text-sm">
                {item.provider && <Icons.provider provider={item.provider} className="size-4 shrink-0" />}
                <span className="truncate" title={item.name}>
                  {item.name}
                </span>
              </span>
              <span className="flex shrink-0 gap-3 text-sm tabular-nums">
                <span>{format.number(item.value)}</span>
                <span className="w-14 text-right text-muted-foreground">
                  {percentNumber.format(item.value / rankedTotal)}
                </span>
              </span>
            </div>
            {rankedItems.length > 1 && (
              <div aria-hidden="true" className="h-1 rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(item.value / rankedTotal) * 100}%` }}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
      {rankedItems.length > 5 && (
        <Button variant="ghost" size="sm" className="self-start" onClick={() => setShowAll(!showAll)}>
          {showAll ? "Show fewer" : `Show all ${rankedItems.length}`}
        </Button>
      )}
    </section>
  );
}
