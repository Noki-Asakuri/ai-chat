import type { DynamicToolUIPart, ToolUIPart, UITools } from "@ai-chat/shared/chat/ui";

import { CheckIcon, CircleDashedIcon, XIcon } from "lucide-react";

import type { ChatMessage } from "@/lib/types";

export type ToolPart = ToolUIPart<UITools> | DynamicToolUIPart;

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

export function stringifyForDetails(value: unknown): string {
  if (typeof value === "string") return value;

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function normalizeSummaryText(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= TOOL_SUMMARY_MAX_LENGTH) return normalized;
  return `${normalized.slice(0, TOOL_SUMMARY_MAX_LENGTH)}...`;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const normalized = value.trim();
  if (normalized.length === 0) return null;

  return normalized;
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

export function summarizeValue(value: unknown): string {
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

  return normalizeSummaryText(String(value));
}

export function ToolStateBadge({ part }: { part: ToolPart }) {
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

export function isToolPart(
  part: ChatMessage["parts"][number],
): part is ChatMessage["parts"][number] & (ToolUIPart<UITools> | DynamicToolUIPart) {
  if (part.type === "dynamic-tool") return true;
  if (part.type.startsWith("tool-")) return true;
  return part.type.startsWith("tools-");
}
