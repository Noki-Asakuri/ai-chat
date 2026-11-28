import type { api } from "@ai-chat/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";

import { prettifyProviderName, tryGetModelData, type Provider } from "@/lib/chat/models";

export type Statistics = FunctionReturnType<typeof api.functions.statistics.getStatistics>;
export type Metric = "tokens" | "messages";
export type Dimension = "model" | "provider" | "profile";

export type Entity = {
  id: string;
  name: string;
  provider?: Provider;
  /** One value per `data.activity` period. */
  values: number[];
  total: number;
  color: string;
};

export const SERIES_COLORS = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
] as const;
export const OTHER_COLOR = "var(--series-other)";
export const UNATTRIBUTED_ID = "unattributed";

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 2 });
export const formatCompact = (value: number) => compact.format(value);

const monthName = new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" });
const monthYearName = new Intl.DateTimeFormat("en", { month: "short", year: "numeric", timeZone: "UTC" });

/** Periods are `YYYY-MM` for a year view and `YYYY` for all time. */
export function periodLabel(period: string, long = false) {
  if (period.length === 4) return period;
  const date = new Date(`${period}-01T00:00:00Z`);
  return (long ? monthYearName : monthName).format(date);
}

export function periodTokens(point: Statistics["activity"][number]) {
  return point.inputTokens + point.outputTokens;
}

/** A period with responses but no token report at all: its token usage is unknown, not zero. */
export function isTokenUnreported(point: Statistics["totals"]) {
  return (
    point.assistantMessagesCount > 0 &&
    point.inputTokens + point.outputTokens === 0 &&
    point.unreportedInputCount === point.assistantMessagesCount &&
    point.unreportedOutputCount === point.assistantMessagesCount
  );
}

/** Some responses in the span lack a token report, so its token total is only a lower bound. */
export function hasMissingTokenReports(point: Statistics["totals"]) {
  return point.unreportedInputCount > 0 || point.unreportedOutputCount > 0;
}

/** Ranks entities by their total and gives the top five a fixed colour; the rest share the neutral. */
function rank(entities: Array<Omit<Entity, "total" | "color">>): Entity[] {
  let slot = 0;
  const ranked: Entity[] = [];
  for (const entity of entities) {
    const total = entity.values.reduce((sum, value) => sum + value, 0);
    if (total > 0) ranked.push(Object.assign(entity, { total, color: OTHER_COLOR }));
  }
  ranked.sort((a, b) => b.total - a.total);
  for (const entity of ranked) {
    if (entity.id !== UNATTRIBUTED_ID && slot < SERIES_COLORS.length) entity.color = SERIES_COLORS[slot++]!;
  }
  return ranked;
}

/** Per-period values for one grouping, or null when the data doesn't record it (profile tokens). */
export function getEntities(data: Statistics, dimension: Dimension, metric: Metric): Entity[] | null {
  const periods = data.activity;
  if (dimension === "profile") {
    if (metric === "tokens") return null;
    const names = new Map(data.aiProfileRank.map((profile) => [profile.id, profile.name]));
    const ids = new Set(periods.flatMap((point) => point.profiles.map((profile) => profile.id)));
    return rank(
      Array.from(ids, (id) => ({
        id,
        name: names.get(id) ?? "Deleted profile",
        values: periods.map((point) => point.profiles.find((profile) => profile.id === id)?.count ?? 0),
      })),
    );
  }

  const ids = new Set(periods.flatMap((point) => point.models.map((model) => model.id)));
  const models = Array.from(ids, (id) => {
    const model = tryGetModelData(id);
    return {
      id,
      name: model?.display.name ?? (id === "unknown" ? "Unknown model" : id),
      provider: model?.provider,
      values: periods.map((point) => {
        const entry = point.models.find((item) => item.id === id);
        return (metric === "tokens" ? entry?.tokens : entry?.count) ?? 0;
      }),
    };
  });
  // Older responses were counted before per-model tokens existed; keep the bars summing to the total.
  if (metric === "tokens") {
    models.push({
      id: UNATTRIBUTED_ID,
      name: "Unattributed",
      provider: undefined,
      values: periods.map((point, index) =>
        Math.max(0, periodTokens(point) - models.reduce((sum, model) => sum + model.values[index]!, 0)),
      ),
    });
  }
  if (dimension === "model") return rank(models);

  const providers = new Map<string, Omit<Entity, "total" | "color">>();
  for (const model of models) {
    const id = model.id === UNATTRIBUTED_ID ? UNATTRIBUTED_ID : (model.provider ?? "unknown");
    const existing = providers.get(id);
    if (existing) {
      existing.values = existing.values.map((value, index) => value + model.values[index]!);
      continue;
    }
    providers.set(id, {
      id,
      name: model.provider
        ? prettifyProviderName(model.provider)
        : id === UNATTRIBUTED_ID
          ? model.name
          : "Unknown provider",
      provider: model.provider,
      values: [...model.values],
    });
  }
  return rank(Array.from(providers.values()));
}

/** Year-over-year change, or null when there is nothing to compare against. */
export function percentChange(current: number, previous: number | undefined) {
  if (previous === undefined || previous === 0) return null;
  return (current - previous) / previous;
}
