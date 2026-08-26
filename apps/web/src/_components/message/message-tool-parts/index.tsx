import { ChevronDownIcon, WrenchIcon } from "lucide-react";

import * as React from "react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../ui/collapsible";
import { Separator } from "../../ui/separator";

import {
  getToolLabel,
  getToolName,
  normalizeSummaryText,
  stringifyForDetails,
  summarizeValue,
  ToolStateBadge,
  type ToolPart,
} from "./shared";
import {
  isWebSearchToolName,
  parseWebSearchOutput,
  summarizeWebSearchOutput,
  WebSearchOutputView,
} from "./web-search-tool-part";

import { cn } from "@/lib/utils";

type MessageToolPartsProps = {
  parts?: ToolPart[] | null;
  className?: string;
};

type ToolDetail = {
  label: string;
  value: string;
};

function getToolSummary(part: ToolPart, hasWebSearchOutput: boolean): string {
  if (part.state === "input-streaming" || part.state === "input-available") {
    return summarizeValue(part.input);
  }

  if (part.state === "output-available") {
    if (hasWebSearchOutput) {
      const webSearchOutput = parseWebSearchOutput(part.output);
      if (webSearchOutput) return summarizeWebSearchOutput(webSearchOutput);
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
}

function getToolDetail(part: ToolPart, isOpen: boolean, hasSpecializedOutput: boolean): ToolDetail | null {
  if (!isOpen) return null;

  if (part.state === "input-streaming" || part.state === "input-available") {
    return { label: "Input", value: stringifyForDetails(part.input) };
  }

  if (part.state === "output-available") {
    if (hasSpecializedOutput) return null;
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
}

function MessageToolPart({ part }: { part: ToolPart }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const toolName = getToolName(part);

  const webSearchOutput = React.useMemo(() => {
    if (!isWebSearchToolName(toolName)) return null;
    if (part.state !== "output-available") return null;

    return parseWebSearchOutput(part.output);
  }, [part.output, part.state, toolName]);

  const summaryText = React.useMemo(() => {
    return getToolSummary(part, webSearchOutput !== null);
  }, [part, webSearchOutput]);

  const detail = React.useMemo(() => {
    return getToolDetail(part, isOpen, webSearchOutput !== null);
  }, [isOpen, part, webSearchOutput]);

  const detailValue = detail?.value ?? "";

  return (
    <div className="message-tool-part rounded-md border bg-background/80 px-2 py-1.5 backdrop-blur-md backdrop-saturate-150">
      <button
        type="button"
        className="flex w-full items-center gap-2 text-left"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <ChevronDownIcon
          className={cn("size-3 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")}
        />

        <span className="min-w-0 shrink text-xs font-medium text-foreground">{getToolLabel(toolName)}</span>

        <span className="text-2xs min-w-0 grow truncate text-muted-foreground">{summaryText}</span>

        <ToolStateBadge part={part} />
      </button>

      {isOpen && webSearchOutput && <WebSearchOutputView output={webSearchOutput} />}

      {detail && detailValue.length > 0 && (
        <div className="mt-1 rounded-md bg-background/80 px-2 py-1.5">
          <div className="text-3xs mb-1 font-medium tracking-wide text-muted-foreground uppercase">
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
  const toolParts = (parts ?? []).filter((part) => {
    if (!isWebSearchToolName(getToolName(part))) return true;
    return part.state !== "approval-responded" || part.approval.approved;
  });

  if (toolParts.length === 0) return null;

  return (
    <Collapsible className={cn("w-full", className)}>
      <CollapsibleTrigger className="group flex min-h-8 w-full items-center gap-2 rounded-md border bg-background/80 px-2 text-left text-sm text-muted-foreground backdrop-blur-md backdrop-saturate-150 transition-colors hover:text-foreground">
        <WrenchIcon className="size-4" />
        <span className="grow">{getToolGroupLabel(toolParts)}</span>
        <ChevronDownIcon className="size-4 transition-transform group-data-panel-open:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="flex h-[var(--collapsible-panel-height)] flex-col overflow-hidden transition-[height] duration-150 ease-out data-ending-style:h-0 data-starting-style:h-0 [&[hidden]:not([hidden='until-found'])]:hidden">
        <div className="flex flex-col gap-1 pt-1">
          {toolParts.map((part) => (
            <MessageToolPart key={part.toolCallId} part={part} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function getToolGroupLabel(parts: ToolPart[]): string {
  const failedCount = parts.filter((part) => part.state === "output-error").length;
  const isRunning = parts.some(
    (part) =>
      part.state !== "output-available" && part.state !== "output-error" && part.state !== "output-denied",
  );
  const noun = parts.length === 1 ? "tool call" : "tool calls";
  const label = isRunning ? `Running ${parts.length} ${noun}` : `Ran ${parts.length} ${noun}`;

  if (failedCount === 0) return label;
  return `${label} · ${failedCount} failed`;
}

export function MessageStepDivider({ className }: { className?: string }) {
  return <Separator className={cn("my-0.5 opacity-50", className)} />;
}
