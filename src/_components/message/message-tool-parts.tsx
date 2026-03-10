import type { DynamicToolUIPart, ToolUIPart, UITools } from "ai";

import { CheckIcon, ChevronDownIcon, CircleDashedIcon, XIcon } from "lucide-react";

import * as React from "react";

import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/types";

type ToolPart = ToolUIPart<UITools> | DynamicToolUIPart;

type MessageToolPartsProps = {
  parts: ToolPart[];
};

function getToolName(part: ToolPart): string {
  if (part.type === "dynamic-tool") return part.toolName;

  return part.type.replace(/^(tool-|tools-)/, "");
}

function stringify(value: unknown): string {
  if (typeof value === "string") return value;

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function summarize(value: unknown): string {
  const normalized = stringify(value).replace(/\s+/g, " ").trim();
  if (normalized.length <= 96) return normalized;
  return `${normalized.slice(0, 96)}...`;
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
  const [isOpen, setIsOpen] = React.useState(
    part.state === "input-streaming" || part.state === "output-error",
  );

  React.useEffect(() => {
    if (part.state === "input-streaming" || part.state === "output-error") {
      setIsOpen(true);
    }
  }, [part.state]);

  let detailLabel = "";
  let detailValue = "";

  if (part.state === "input-streaming" || part.state === "input-available") {
    detailLabel = "Input";
    detailValue = stringify(part.input);
  } else if (part.state === "output-available") {
    detailLabel = "Output";
    detailValue = stringify(part.output);
  } else if (part.state === "output-error") {
    detailLabel = "Error";
    detailValue = part.errorText;
  } else if (part.state === "approval-requested") {
    detailLabel = "Approval";
    detailValue = "Approval required";
  } else if (part.state === "output-denied") {
    detailLabel = "Denied";
    detailValue = "Tool execution denied";
  }

  const summaryText =
    part.state === "input-streaming" || part.state === "input-available"
      ? summarize(part.input)
      : part.state === "output-available"
        ? summarize(part.output)
        : part.state === "output-error"
          ? summarize(part.errorText)
          : part.state === "approval-requested"
            ? "Approval required"
            : part.state === "output-denied"
              ? "Execution denied"
              : "";

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

        <span className="min-w-0 shrink text-xs font-medium text-foreground">{toolName}</span>

        <span className="min-w-0 grow truncate text-[11px] text-muted-foreground">
          {summaryText}
        </span>

        <ToolStateBadge part={part} />
      </button>

      {isOpen && detailValue.length > 0 && (
        <div className="mt-1 rounded bg-background/80 px-2 py-1.5">
          <div className="mb-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            {detailLabel}
          </div>
          <pre className="overflow-x-auto text-xs break-words whitespace-pre-wrap text-foreground">
            {detailValue}
          </pre>
        </div>
      )}
    </div>
  );
}

export function MessageToolParts({ parts }: MessageToolPartsProps) {
  if (parts.length === 0) return null;

  return (
    <div className="order-1 mb-1.5 flex w-full flex-col gap-1">
      {parts.map((part, index) => (
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
