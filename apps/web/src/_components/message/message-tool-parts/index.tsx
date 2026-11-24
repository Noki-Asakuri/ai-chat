import { ChevronRightIcon, WrenchIcon } from "lucide-react";

import * as React from "react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../ui/collapsible";
import { Separator } from "../../ui/separator";

import { ImageGenerationToolPart } from "./image-generation-tool-part";
import {
  getToolLabel,
  getToolName,
  isImageGenerationToolName,
  normalizeSummaryText,
  stringifyForDetails,
  summarizeValue,
  ToolStateBadge,
  ToolStateIcon,
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
  isStreaming?: boolean;
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
    <div className="message-tool-part min-w-0">
      <button
        type="button"
        aria-expanded={isOpen}
        className="-mx-1 flex min-h-7 w-[calc(100%+0.5rem)] min-w-0 items-center gap-2 rounded-md px-1 text-left text-sm transition-colors outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/60"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <ToolStateIcon part={part} />

        <span className="shrink-0 font-medium text-foreground">{getToolLabel(toolName)}</span>

        <span className="min-w-0 grow truncate text-xs text-muted-foreground">{summaryText}</span>

        <ToolStateBadge part={part} className="hidden sm:inline-flex" />

        <ChevronRightIcon
          aria-hidden="true"
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform",
            isOpen && "rotate-90",
          )}
        />
      </button>

      {isOpen && webSearchOutput && <WebSearchOutputView output={webSearchOutput} />}

      {detail && detailValue.length > 0 && (
        <div className="mt-1 mb-1.5 ml-5.5 rounded-lg bg-muted/40 px-2.5 py-2">
          <div className="text-3xs mb-1 font-medium tracking-wide text-muted-foreground uppercase">
            {detail.label}
          </div>
          <pre className="max-h-72 overflow-auto text-xs break-words whitespace-pre-wrap text-foreground">
            {detailValue}
          </pre>
        </div>
      )}
    </div>
  );
}

export function MessageToolParts({ parts, className, isStreaming = true }: MessageToolPartsProps) {
  const toolParts = (parts ?? []).filter((part) => {
    if (!isWebSearchToolName(getToolName(part))) return true;
    return part.state !== "approval-responded" || part.approval.approved;
  });

  if (toolParts.length === 0) return null;

  if (toolParts.some((part) => isImageGenerationToolName(getToolName(part)))) {
    const groups: ToolPart[][] = [];
    for (const part of toolParts) {
      const previousGroup = groups.at(-1);
      if (
        !isImageGenerationToolName(getToolName(part)) &&
        previousGroup &&
        !isImageGenerationToolName(getToolName(previousGroup[0]!))
      ) {
        previousGroup.push(part);
      } else {
        groups.push([part]);
      }
    }

    return (
      <div className={cn("flex w-full min-w-0 flex-col gap-1.5", className)}>
        {groups.map((group) => {
          const part = group[0]!;
          return isImageGenerationToolName(getToolName(part)) ? (
            <ImageGenerationToolPart key={part.toolCallId} part={part} isStreaming={isStreaming} />
          ) : (
            <MessageToolParts key={part.toolCallId} parts={group} isStreaming={isStreaming} />
          );
        })}
      </div>
    );
  }

  return (
    <Collapsible className={cn("w-full", className)}>
      <CollapsibleTrigger className="group/tool-group -mx-1 flex h-7 w-[calc(100%+0.5rem)] min-w-0 items-center gap-2 rounded-md px-1 text-left text-sm text-muted-foreground transition-colors outline-none hover:bg-muted/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60">
        <WrenchIcon aria-hidden="true" className="size-3.5 shrink-0" />
        <span className="min-w-0 grow truncate">{getToolGroupLabel(toolParts)}</span>
        <ChevronRightIcon
          aria-hidden="true"
          className="size-3.5 shrink-0 transition-transform group-data-panel-open/tool-group:rotate-90"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="flex h-[var(--collapsible-panel-height)] flex-col overflow-hidden transition-[height] duration-150 ease-out data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none [&[hidden]:not([hidden='until-found'])]:hidden">
        <div className="ml-[0.4375rem] flex flex-col border-l border-border/70 py-1 pl-3.5">
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
  return <Separator className={cn("my-1 opacity-60", className)} />;
}
