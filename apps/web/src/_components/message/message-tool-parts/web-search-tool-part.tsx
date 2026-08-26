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
  return `${count} ${count === 1 ? "source" : "sources"}`;
}

function WebSearchResult({ result }: { result: ParsedWebSearchResult }) {
  const hostname = getHostname(result.url);
  const publishedDate = formatPublishedDate(result.publishedDate);

  return (
    <a
      href={result.url}
      target="_blank"
      rel="noreferrer"
      className="group flex min-w-0 items-center gap-2.5 rounded-md px-2 py-2 transition-colors hover:bg-muted/45 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted/70">
        {result.favicon ? (
          <img alt="" src={result.favicon} className="size-4 rounded-sm" />
        ) : (
          <GlobeIcon className="size-3.5 text-muted-foreground" />
        )}
      </span>

      <span className="min-w-0 grow">
        <span className="block truncate text-xs font-medium text-foreground group-hover:underline group-hover:underline-offset-2">
          {result.title}
        </span>

        <span className="text-2xs mt-0.5 flex min-w-0 items-center gap-1.5 text-muted-foreground">
          <span className="truncate">{hostname}</span>
          {publishedDate && (
            <>
              <span aria-hidden="true" className="shrink-0 text-border">
                ·
              </span>
              <span className="shrink-0 tabular-nums">{publishedDate}</span>
            </>
          )}
        </span>
      </span>

      <ExternalLinkIcon
        aria-hidden="true"
        className="size-3.5 shrink-0 text-muted-foreground/70 transition-colors group-hover:text-foreground"
      />
    </a>
  );
}

export function WebSearchOutputView({ output }: { output: ParsedWebSearchOutput }) {
  return (
    <div className="-mx-1 mt-1 border-t border-border/60 pt-1">
      {output.results.map((result, index) => {
        const id = result.id ?? result.url;
        return <WebSearchResult key={`${id}-${index}`} result={result} />;
      })}
    </div>
  );
}
