import type { DynamicToolUIPart, ToolUIPart } from "@ai-chat/shared/chat/ui";
import { z } from "zod/v4";

import { CheckIcon, CircleDashedIcon, XIcon } from "lucide-react";

import type { ChatMessage } from "@/lib/types";

export type ToolPart = ToolUIPart | DynamicToolUIPart;

const TOOL_SUMMARY_MAX_LENGTH = 96;

export function getToolName(part: ToolPart): string {
  if (part.type === "dynamic-tool") return part.toolName;

  return part.type.replace(/^(tool-|tools-)/, "");
}

export function getToolLabel(toolName: string): string {
  if (toolName === "web_search" || toolName === "webSearch") {
    return "Web search";
  }

  return toolName.replace(/_/g, " ");
}

export function stringifyForDetails(cause: unknown): string {
  const stringResult = z.string().safeParse(cause);
  if (stringResult.success) return stringResult.data;

  try {
    return JSON.stringify(cause, null, 2);
  } catch {
    return String(cause);
  }
}

export function normalizeSummaryText(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= TOOL_SUMMARY_MAX_LENGTH) return normalized;
  return `${normalized.slice(0, TOOL_SUMMARY_MAX_LENGTH)}...`;
}

function summarizeInline(cause: unknown): string {
  const stringResult = z.string().safeParse(cause);
  if (stringResult.success) {
    const value = stringResult.data;
    return JSON.stringify(value.length > 24 ? `${value.slice(0, 24)}...` : value);
  }

  const scalarResult = z.union([z.number(), z.boolean(), z.null()]).safeParse(cause);
  if (scalarResult.success) {
    return String(scalarResult.data);
  }

  if (Array.isArray(cause)) {
    return `[Array(${cause.length})]`;
  }

  if (z.record(z.string(), z.unknown()).safeParse(cause).success) {
    return "{...}";
  }

  return String(cause);
}

export function summarizeValue(cause: unknown): string {
  const stringResult = z.string().safeParse(cause);
  if (stringResult.success) {
    return normalizeSummaryText(stringResult.data);
  }

  const scalarResult = z.union([z.number(), z.boolean(), z.null()]).safeParse(cause);
  if (scalarResult.success) {
    return String(scalarResult.data);
  }

  if (Array.isArray(cause)) {
    const preview = cause
      .slice(0, 3)
      .map((item) => summarizeInline(item))
      .join(", ");
    const suffix = cause.length > 3 ? ", ..." : "";

    return normalizeSummaryText(`[${preview}${suffix}]`);
  }

  const recordResult = z.record(z.string(), z.unknown()).safeParse(cause);
  if (recordResult.success) {
    const value = recordResult.data;
    const preview: string[] = [];
    let hasMoreEntries = false;
    let seenEntries = 0;

    for (const key in value) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) continue;

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

  return normalizeSummaryText(String(cause));
}

export function ToolStateBadge({ part }: { part: ToolPart }) {
  switch (part.state) {
    case "input-streaming":
      return (
        <span className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
          <CircleDashedIcon className="size-3 animate-spin" />
          Calling
        </span>
      );
    case "input-available":
      return (
        <span className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
          Input ready
        </span>
      );
    case "approval-requested":
      return (
        <span className="inline-flex items-center gap-1 rounded-md border border-amber-600/60 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-500">
          Awaiting approval
        </span>
      );
    case "approval-responded":
      return (
        <span className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
          Approval sent
        </span>
      );
    case "output-available":
      return (
        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-600/60 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-500">
          <CheckIcon className="size-3" />
          Completed
        </span>
      );
    case "output-error":
      return (
        <span className="inline-flex items-center gap-1 rounded-md border border-destructive/60 bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
          <XIcon className="size-3" />
          Error
        </span>
      );
    case "output-denied":
      return (
        <span className="inline-flex items-center gap-1 rounded-md border border-amber-600/60 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-500">
          Denied
        </span>
      );
    default:
      return null;
  }
}

export function isToolPart(
  part: ChatMessage["parts"][number],
): part is ChatMessage["parts"][number] & (ToolUIPart | DynamicToolUIPart) {
  if (part.type === "dynamic-tool") return true;
  if (part.type.startsWith("tool-")) return true;
  return part.type.startsWith("tools-");
}
