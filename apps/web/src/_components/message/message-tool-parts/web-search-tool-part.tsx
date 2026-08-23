/* oxlint-disable react/no-array-index-key -- Providers can return duplicate result identifiers. */
import { ExternalLinkIcon, GlobeIcon } from "lucide-react";
import { z } from "zod/v4";

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

const nullableNonEmptyString = z.string().trim().min(1).nullable().catch(null);
const webSearchResultSchema = z.object({
  id: nullableNonEmptyString.optional().default(null),
  title: nullableNonEmptyString.optional().default(null),
  url: z.string().trim().min(1),
  favicon: nullableNonEmptyString.optional().default(null),
  publishedDate: nullableNonEmptyString.optional().default(null),
});
const webSearchOutputSchema = z.object({
  requestId: nullableNonEmptyString.optional().default(null),
  resolvedSearchType: nullableNonEmptyString.optional().default(null),
  results: z.array(z.unknown()),
});

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

export function parseWebSearchOutput(cause: unknown): ParsedWebSearchOutput | null {
  const parsed = webSearchOutputSchema.safeParse(cause);
  if (!parsed.success) return null;

  const results: Array<ParsedWebSearchResult> = [];

  for (const rawResult of parsed.data.results) {
    const parsedResult = webSearchResultSchema.safeParse(rawResult);
    if (!parsedResult.success) continue;

    results.push({
      ...parsedResult.data,
      title: parsedResult.data.title ?? parsedResult.data.url,
    });
  }

  if (results.length === 0) return null;

  return {
    requestId: parsed.data.requestId,
    resolvedSearchType: parsed.data.resolvedSearchType,
    results,
  };
}

export function summarizeWebSearchOutput(output: ParsedWebSearchOutput): string {
  const count = output.results.length;
  const searchType = prettifySearchType(output.resolvedSearchType);
  const summary = `${count} ${count === 1 ? "result" : "results"}`;

  return searchType ? `${summary} (${searchType})` : summary;
}

function buildWebSearchHeaderIcons(results: Array<ParsedWebSearchResult>): Array<WebSearchHeaderResultIcon> {
  const icons: Array<WebSearchHeaderResultIcon> = [];
  const seen = new Set<string>();

  for (const result of results) {
    const hostname = getHostname(result.url);
    if (seen.has(hostname)) continue;

    seen.add(hostname);
    icons.push({ key: result.id ?? result.url, favicon: result.favicon, title: result.title });

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
      className="block rounded-md border border-border/70 bg-background/80 px-2 py-1.5 transition-colors hover:bg-muted/35"
    >
      <div className="flex min-w-0 items-start gap-2">
        {result.favicon ? (
          <img alt="" src={result.favicon} className="mt-0.5 size-3.5 shrink-0 rounded-sm" />
        ) : (
          <GlobeIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
        )}

        <div className="min-w-0 grow">
          <div className="line-clamp-2 text-xs font-medium text-foreground">{result.title}</div>

          <div className="text-2xs mt-0.5 flex items-center gap-1 text-muted-foreground">
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

  return (
    <div className="mt-1 rounded-md bg-background/80 px-2 py-1.5">
      <div className="text-3xs mb-1 flex flex-wrap items-center gap-1.5 text-muted-foreground uppercase">
        <span className="rounded-md border border-border/70 bg-muted/40 px-1.5 py-0.5">
          {resultCount} {resultCount === 1 ? "result" : "results"}
        </span>

        {searchType && (
          <span className="rounded-md border border-border/70 bg-muted/40 px-1.5 py-0.5">{searchType}</span>
        )}

        {output.requestId && (
          <span className="truncate rounded-md border border-border/70 bg-muted/40 px-1.5 py-0.5">
            req {output.requestId.slice(0, 10)}
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
    <div className="-ml-1 flex shrink-0 items-center">
      {icons.map((icon) => (
        <span
          key={icon.key}
          title={icon.title}
          className="-mr-1 flex size-4 items-center justify-center rounded-md border border-background bg-muted"
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
