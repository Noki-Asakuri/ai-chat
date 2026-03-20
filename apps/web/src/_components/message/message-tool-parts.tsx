import type { DynamicToolUIPart, ToolUIPart, UITools } from "ai";

import {
  CheckIcon,
  ChevronDownIcon,
  CircleDashedIcon,
  ExternalLinkIcon,
  GlobeIcon,
  XIcon,
} from "lucide-react";

import * as React from "react";

import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/types";

export type ToolPart = ToolUIPart<UITools> | DynamicToolUIPart;

type MessageToolPartsProps = {
  parts?: ToolPart[] | null;
  className?: string;
};

const TOOL_SUMMARY_MAX_LENGTH = 96;

type ParsedWebSearchResult = {
  id: string | null;
  title: string;
  url: string;
  favicon: string | null;
  publishedDate: string | null;
};

type ParsedWebSearchOutput = {
  requestId: string | null;
  resolvedSearchType: string | null;
  results: Array<ParsedWebSearchResult>;
};

type WebSearchHeaderResultIcon = {
  key: string;
  favicon: string | null;
  title: string;
};

function getToolName(part: ToolPart): string {
  if (part.type === "dynamic-tool") return part.toolName;

  return part.type.replace(/^(tool-|tools-)/, "");
}

function getToolLabel(toolName: string): string {
  if (toolName === "web_search" || toolName === "webSearch") {
    return "Web search";
  }

  return toolName.replace(/_/g, " ");
}

function stringifyForDetails(value: unknown): string {
  if (typeof value === "string") return value;

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function normalizeSummaryText(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= TOOL_SUMMARY_MAX_LENGTH) return normalized;
  return `${normalized.slice(0, TOOL_SUMMARY_MAX_LENGTH)}...`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const normalized = value.trim();
  if (normalized.length === 0) return null;

  return normalized;
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

function isWebSearchToolName(toolName: string): boolean {
  return toolName === "web_search" || toolName === "webSearch";
}

function getHostname(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function parseWebSearchOutput(value: unknown): ParsedWebSearchOutput | null {
  if (!isRecord(value)) return null;

  const rawResults = value["results"];
  if (!Array.isArray(rawResults)) return null;

  const results: Array<ParsedWebSearchResult> = [];

  for (const rawResult of rawResults) {
    if (!isRecord(rawResult)) continue;

    const url = toNonEmptyString(rawResult["url"]);
    if (!url) continue;

    const title = toNonEmptyString(rawResult["title"]) ?? url;

    results.push({
      id: toNonEmptyString(rawResult["id"]),
      title,
      url,
      favicon: toNonEmptyString(rawResult["favicon"]),
      publishedDate: toNonEmptyString(rawResult["publishedDate"]),
    });
  }

  if (results.length === 0) return null;

  return {
    requestId: toNonEmptyString(value["requestId"]),
    resolvedSearchType: toNonEmptyString(value["resolvedSearchType"]),
    results,
  };
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

function WebSearchOutputView({ output }: { output: ParsedWebSearchOutput }) {
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

function WebSearchHeaderIcons({ icons }: { icons: Array<WebSearchHeaderResultIcon> }) {
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

function summarizeInline(value: unknown): string {
  if (typeof value === "string") {
    return JSON.stringify(value.length > 24 ? `${value.slice(0, 24)}...` : value);
  }

  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return String(value);
  }

  if (Array.isArray(value)) {
    return `[Array(${value.length})]`;
  }

  if (typeof value === "object" && value !== null) {
    return "{...}";
  }

  return String(value);
}

function summarizeValue(value: unknown): string {
  if (typeof value === "string") {
    return normalizeSummaryText(value);
  }

  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return String(value);
  }

  if (Array.isArray(value)) {
    const preview = value
      .slice(0, 3)
      .map((item) => summarizeInline(item))
      .join(", ");
    const suffix = value.length > 3 ? ", ..." : "";

    return normalizeSummaryText(`[${preview}${suffix}]`);
  }

  if (isRecord(value)) {
    const preview: string[] = [];
    let hasMoreEntries = false;
    let seenEntries = 0;

    for (const key in value) {
      if (!Object.hasOwn(value, key)) continue;

      seenEntries += 1;

      if (preview.length < 3) {
        preview.push(`${key}: ${summarizeInline(value[key])}`);
      }

      if (seenEntries >= 4) {
        hasMoreEntries = true;
        break;
      }
    }

    if (preview.length === 0) return "{}";

    const suffix = hasMoreEntries ? ", ..." : "";
    return normalizeSummaryText(`{ ${preview.join(", ")}${suffix} }`);
  }

  return normalizeSummaryText(String(value));
}

function ToolStateBadge({ part }: { part: ToolPart }) {
  switch (part.state) {
    case "input-streaming":
      return (
        <span className="inline-flex items-center gap-1 rounded border border-border/70 bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
          <CircleDashedIcon className="size-3 animate-spin" />
          Calling
        </span>
      );
    case "input-available":
      return (
        <span className="inline-flex items-center gap-1 rounded border border-border/70 bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
          Input ready
        </span>
      );
    case "approval-requested":
      return (
        <span className="inline-flex items-center gap-1 rounded border border-amber-600/60 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-500">
          Awaiting approval
        </span>
      );
    case "approval-responded":
      return (
        <span className="inline-flex items-center gap-1 rounded border border-border/70 bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
          Approval sent
        </span>
      );
    case "output-available":
      return (
        <span className="inline-flex items-center gap-1 rounded border border-emerald-600/60 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-500">
          <CheckIcon className="size-3" />
          Completed
        </span>
      );
    case "output-error":
      return (
        <span className="inline-flex items-center gap-1 rounded border border-destructive/60 bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
          <XIcon className="size-3" />
          Error
        </span>
      );
    case "output-denied":
      return (
        <span className="inline-flex items-center gap-1 rounded border border-amber-600/60 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-500">
          Denied
        </span>
      );
    default:
      return null;
  }
}

function MessageToolPart({ part }: { part: ToolPart }) {
  const toolName = getToolName(part);
  const isWebSearchTool = isWebSearchToolName(toolName);
  const webSearchOutput = React.useMemo(() => {
    if (!isWebSearchTool) return null;
    if (part.state !== "output-available") return null;

    return parseWebSearchOutput(part.output);
  }, [isWebSearchTool, part.output, part.state]);

  const webSearchHeaderIcons = React.useMemo(() => {
    if (!webSearchOutput) return [];

    return buildWebSearchHeaderIcons(webSearchOutput.results);
  }, [webSearchOutput]);

  const shouldAutoOpen = part.state === "input-streaming" || part.state === "output-error";
  const [isOpen, setIsOpen] = React.useState(shouldAutoOpen);

  React.useEffect(() => {
    if (shouldAutoOpen) {
      setIsOpen(true);
    }
  }, [shouldAutoOpen]);

  const summaryText = React.useMemo(() => {
    if (part.state === "input-streaming" || part.state === "input-available") {
      return summarizeValue(part.input);
    }

    if (part.state === "output-available") {
      if (webSearchOutput) {
        const count = webSearchOutput.results.length;
        const searchType = prettifySearchType(webSearchOutput.resolvedSearchType);
        const summary = `${count} ${count === 1 ? "result" : "results"}`;

        return searchType ? `${summary} (${searchType})` : summary;
      }

      return summarizeValue(part.output);
    }

    if (part.state === "output-error") {
      return normalizeSummaryText(part.errorText ?? "Tool execution failed");
    }

    if (part.state === "approval-requested") {
      return "Approval required";
    }

    if (part.state === "output-denied") {
      return "Execution denied";
    }

    return "";
  }, [part.errorText, part.input, part.output, part.state, webSearchOutput]);

  const detail = React.useMemo(() => {
    if (!isOpen) return null;

    if (part.state === "input-streaming" || part.state === "input-available") {
      return { label: "Input", value: stringifyForDetails(part.input) };
    }

    if (part.state === "output-available") {
      if (webSearchOutput) return null;
      return { label: "Output", value: stringifyForDetails(part.output) };
    }

    if (part.state === "output-error") {
      return { label: "Error", value: part.errorText ?? "Tool execution failed" };
    }

    if (part.state === "approval-requested") {
      return { label: "Approval", value: "Approval required" };
    }

    if (part.state === "output-denied") {
      return { label: "Denied", value: "Tool execution denied" };
    }

    return null;
  }, [isOpen, part.errorText, part.input, part.output, part.state, webSearchOutput]);

  const detailValue = detail?.value ?? "";

  return (
    <div className="rounded-md border bg-background/80 px-2 py-1.5 backdrop-blur-md backdrop-saturate-150">
      <button
        type="button"
        className="flex w-full items-center gap-2 text-left"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <ChevronDownIcon
          className={cn(
            "size-3 shrink-0 text-muted-foreground transition-transform",
            isOpen && "rotate-180",
          )}
        />

        <span className="min-w-0 shrink text-xs font-medium text-foreground">
          {getToolLabel(toolName)}
        </span>

        <span className="min-w-0 grow truncate text-[11px] text-muted-foreground">
          {summaryText}
        </span>

        {isWebSearchTool && part.state === "output-available" && (
          <WebSearchHeaderIcons icons={webSearchHeaderIcons} />
        )}

        <ToolStateBadge part={part} />
      </button>

      {isOpen && webSearchOutput && <WebSearchOutputView output={webSearchOutput} />}

      {detail && detailValue.length > 0 && (
        <div className="mt-1 rounded bg-background/80 px-2 py-1.5">
          <div className="mb-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            {detail.label}
          </div>
          <pre className="overflow-x-auto text-xs break-words whitespace-pre-wrap text-foreground">
            {detailValue}
          </pre>
        </div>
      )}
    </div>
  );
}

export function MessageToolParts({ parts, className }: MessageToolPartsProps) {
  const toolParts = parts ?? [];

  if (toolParts.length === 0) return null;

  return (
    <div className={cn("flex w-full flex-col gap-1", className)}>
      {toolParts.map((part, index) => (
        <MessageToolPart key={`${part.toolCallId}-${index}`} part={part} />
      ))}
    </div>
  );
}

export function isToolPart(
  part: ChatMessage["parts"][number],
): part is ChatMessage["parts"][number] & (ToolUIPart<UITools> | DynamicToolUIPart) {
  if (part.type === "dynamic-tool") return true;
  if (part.type.startsWith("tool-")) return true;
  return part.type.startsWith("tools-");
}

export function MessageStepDivider({ className }: { className?: string }) {
  return <hr className={cn("my-0.5 border-border/50", className)} />;
}
