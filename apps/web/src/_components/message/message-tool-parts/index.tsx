import { ChevronDownIcon } from "lucide-react";

import * as React from "react";

import {
  getToolLabel,
  getToolName,
  normalizeSummaryText,
  stringifyForDetails,
  summarizeValue,
  ToolStateBadge,
  type ToolPart,
  isToolPart,
} from "./shared";
import {
  isWebSearchToolName,
  parseWebSearchOutput,
  summarizeWebSearchOutput,
  WebSearchHeaderIcons,
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

function getToolDetail(
  part: ToolPart,
  isOpen: boolean,
  hasSpecializedOutput: boolean,
): ToolDetail | null {
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

        {webSearchOutput && <WebSearchHeaderIcons output={webSearchOutput} />}

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

export function MessageStepDivider({ className }: { className?: string }) {
  return <hr className={cn("my-0.5 border-border/50", className)} />;
}

export { isToolPart, type ToolPart };
