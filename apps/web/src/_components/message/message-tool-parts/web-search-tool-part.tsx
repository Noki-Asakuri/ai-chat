import { ExternalLinkIcon, GlobeIcon } from "lucide-react";

import { isRecord, toNonEmptyString } from "./shared";

export type ParsedWebSearchResult = {
  id: string | null;
  title: string;
  url: string;
  favicon: string | null;
  publishedDate: string | null;
};

export type ParsedWebSearchOutput = {
  requestId: string | null;
  resolvedSearchType: string | null;
  results: Array<ParsedWebSearchResult>;
};

type WebSearchHeaderResultIcon = {
  key: string;
  favicon: string | null;
  title: string;
};

export function isWebSearchToolName(toolName: string): boolean {
  return toolName === "web_search" || toolName === "webSearch";
}

function prettifySearchType(value: string | null): string | null {
  if (!value) return null;

  return value
    .split("-")
    .map((segment) => {
      if (segment.length === 0) return segment;
      return segment.charAt(0).toUpperCase() + segment.slice(1);
    })
    .join(" ");
}

function formatPublishedDate(value: string | null): string | null {
  if (!value) return null;

  if (value.length >= 10) {
    return value.slice(0, 10);
  }

  return value;
}

function getHostname(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function parseWebSearchOutput(value: unknown): ParsedWebSearchOutput | null {
  if (!isRecord(value)) return null;

  const rawResults = value.results;
  if (!Array.isArray(rawResults)) return null;

  const results: Array<ParsedWebSearchResult> = [];

  for (const rawResult of rawResults) {
    if (!isRecord(rawResult)) continue;

    const url = toNonEmptyString(rawResult.url);
    if (!url) continue;

    const title = toNonEmptyString(rawResult.title) ?? url;

    results.push({
      id: toNonEmptyString(rawResult.id),
      title,
      url,
      favicon: toNonEmptyString(rawResult.favicon),
      publishedDate: toNonEmptyString(rawResult.publishedDate),
    });
  }

  if (results.length === 0) return null;

  return {
    requestId: toNonEmptyString(value.requestId),
    resolvedSearchType: toNonEmptyString(value.resolvedSearchType),
    results,
  };
}

export function summarizeWebSearchOutput(output: ParsedWebSearchOutput): string {
  const count = output.results.length;
  const searchType = prettifySearchType(output.resolvedSearchType);
  const summary = `${count} ${count === 1 ? "result" : "results"}`;

  return searchType ? `${summary} (${searchType})` : summary;
}

function buildWebSearchHeaderIcons(
  results: Array<ParsedWebSearchResult>,
): Array<WebSearchHeaderResultIcon> {
  const icons: Array<WebSearchHeaderResultIcon> = [];
  const seen = new Set<string>();

  for (const result of results) {
    const hostname = getHostname(result.url);
    if (seen.has(hostname)) continue;

    seen.add(hostname);
    icons.push({
      key: result.id ?? result.url,
      favicon: result.favicon,
      title: result.title,
    });

    if (icons.length >= 5) break;
  }

  return icons;
}

function WebSearchResultCard({ result }: { result: ParsedWebSearchResult }) {
  const hostname = getHostname(result.url);
  const publishedDate = formatPublishedDate(result.publishedDate);

  return (
    <a
      href={result.url}
      target="_blank"
      rel="noreferrer"
      className="block rounded border border-border/70 bg-background/80 px-2 py-1.5 transition-colors hover:bg-muted/35"
    >
      <div className="flex min-w-0 items-start gap-2">
        {result.favicon ? (
          <img alt="" src={result.favicon} className="mt-0.5 size-3.5 shrink-0 rounded-sm" />
        ) : (
          <GlobeIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
        )}

        <div className="min-w-0 grow">
          <div className="line-clamp-2 text-xs font-medium text-foreground">{result.title}</div>

          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            <span className="truncate">{hostname}</span>
            {publishedDate && <span>{`- ${publishedDate}`}</span>}
          </div>
        </div>

        <ExternalLinkIcon className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
      </div>
    </a>
  );
}

export function WebSearchOutputView({ output }: { output: ParsedWebSearchOutput }) {
  const searchType = prettifySearchType(output.resolvedSearchType);
  const resultCount = output.results.length;
  const requestId = output.requestId;

  return (
    <div className="mt-1 rounded bg-background/80 px-2 py-1.5">
      <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground uppercase">
        <span className="rounded border border-border/70 bg-muted/40 px-1.5 py-0.5">
          {resultCount} {resultCount === 1 ? "result" : "results"}
        </span>

        {searchType && (
          <span className="rounded border border-border/70 bg-muted/40 px-1.5 py-0.5">
            {searchType}
          </span>
        )}

        {requestId && (
          <span className="truncate rounded border border-border/70 bg-muted/40 px-1.5 py-0.5">
            req {requestId.slice(0, 10)}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1">
        {output.results.map((result, index) => {
          const id = result.id ?? result.url;
          return <WebSearchResultCard key={`${id}-${index}`} result={result} />;
        })}
      </div>
    </div>
  );
}

export function WebSearchHeaderIcons({ output }: { output: ParsedWebSearchOutput }) {
  const icons = buildWebSearchHeaderIcons(output.results);
  if (icons.length === 0) return null;

  return (
    <div className="flex shrink-0 items-center -space-x-1">
      {icons.map((icon) => (
        <span
          key={icon.key}
          title={icon.title}
          className="flex size-4 items-center justify-center rounded border border-background bg-muted"
        >
          {icon.favicon ? (
            <img alt="" src={icon.favicon} className="size-3 rounded-[2px]" />
          ) : (
            <GlobeIcon className="size-2.5 text-muted-foreground" />
          )}
        </span>
      ))}
    </div>
  );
}
