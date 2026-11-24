import type { DynamicToolUIPart, ToolUIPart } from "@ai-chat/shared/chat/ui";
import { z } from "zod/v4";

import { CheckIcon, CircleAlertIcon, CircleDashedIcon, XIcon } from "lucide-react";

import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

export type ToolPart = ToolUIPart | DynamicToolUIPart;

const TOOL_SUMMARY_MAX_LENGTH = 96;

export function getToolName(part: ToolPart): string {
  if (part.type === "dynamic-tool") return part.toolName;

  return part.type.replace(/^(tool-|tools-)/, "");
}

export function isImageGenerationToolName(toolName: string): boolean {
  return toolName === "image_generation" || toolName === "imageGeneration";
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

const TOOL_BADGE_BASE_CLASS = "items-center gap-1 rounded-full border px-1.5 py-px text-xs";
const TOOL_BADGE_TONE_CLASS = {
  muted: "border-border/70 text-muted-foreground",
  warning: "border-amber-600/50 text-amber-500",
  success: "border-emerald-600/50 text-emerald-500",
  error: "border-destructive/50 text-destructive",
} as const;

function getToolStateBadge(
  part: ToolPart,
): { label: string; tone: keyof typeof TOOL_BADGE_TONE_CLASS } | null {
  switch (part.state) {
    case "input-streaming":
      return { label: "Calling", tone: "muted" };
    case "input-available":
      return { label: "Input ready", tone: "muted" };
    case "approval-requested":
      return { label: "Awaiting approval", tone: "warning" };
    case "approval-responded":
      return { label: "Approval sent", tone: "muted" };
    case "output-available":
      return { label: "Completed", tone: "success" };
    case "output-error":
      return { label: "Error", tone: "error" };
    case "output-denied":
      return { label: "Denied", tone: "warning" };
    default:
      return null;
  }
}

export function ToolStateBadge({ part, className }: { part: ToolPart; className?: string }) {
  const badge = getToolStateBadge(part);
  if (!badge) return null;

  return (
    <span
      className={cn(
        "inline-flex shrink-0",
        TOOL_BADGE_BASE_CLASS,
        TOOL_BADGE_TONE_CLASS[badge.tone],
        className,
      )}
    >
      {badge.label}
    </span>
  );
}

export function ToolStateIcon({ part }: { part: ToolPart }) {
  const className = "size-3.5 shrink-0";
  const label = getToolStateBadge(part)?.label;

  switch (part.state) {
    case "input-streaming":
    case "input-available":
    case "approval-responded":
      return (
        <CircleDashedIcon
          aria-label={label}
          className={cn(className, "animate-spin text-muted-foreground motion-reduce:animate-none")}
        />
      );
    case "output-available":
      return <CheckIcon aria-label={label} className={cn(className, "text-emerald-500")} />;
    case "output-error":
      return <XIcon aria-label={label} className={cn(className, "text-destructive")} />;
    case "approval-requested":
    case "output-denied":
      return <CircleAlertIcon aria-label={label} className={cn(className, "text-amber-500")} />;
    default:
      return <CircleDashedIcon aria-hidden="true" className={cn(className, "text-muted-foreground")} />;
  }
}

export function isToolPart(
  part: ChatMessage["parts"][number],
): part is ChatMessage["parts"][number] & (ToolUIPart | DynamicToolUIPart) {
  if (part.type === "dynamic-tool") return true;
  if (part.type.startsWith("tool-")) return true;
  return part.type.startsWith("tools-");
}
