"use client";
/* oxlint-disable react/jsx-no-constructed-context-values -- React Compiler stabilizes provider values. */

import type { Collapsible } from "@base-ui/react/collapsible";
import { BrainIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { createContext, memo, use, useEffect, useEffectEvent, useRef, useState } from "react";

import { StreamDownWrapper } from "@/components/message/message-markdown";
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace";

import { cn } from "@/lib/utils";

type ReasoningContextValue = {
  isStreaming: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  duration?: number;
};

const ReasoningContext = createContext<ReasoningContextValue | null>(null);

export const useReasoning = () => {
  const context = use(ReasoningContext);
  if (!context) {
    throw new Error("Reasoning components must be used within Reasoning");
  }
  return context;
};

export type ReasoningProps = ComponentProps<typeof Collapsible.Root> & {
  isStreaming?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  duration?: number;
};

export const Reasoning = memo(
  ({
    className,
    isStreaming = false,
    open,
    defaultOpen = true,
    onOpenChange,
    duration,
    children,
    ...props
  }: ReasoningProps) => {
    const [uncontrolledOpen, setUncontrolledOpen] = useState(isStreaming || defaultOpen);
    const isOpen = open ?? uncontrolledOpen;

    const setIsOpen = (newOpen: boolean) => {
      if (open === undefined) {
        setUncontrolledOpen(newOpen);
      }
      if (newOpen !== isOpen) {
        onOpenChange?.(newOpen);
      }
    };
    const setAutomaticOpen = useEffectEvent(setIsOpen);

    const hasUserToggled = useRef(false);
    const startTime = useRef<number | null>(null);
    const [measuredDuration, setMeasuredDuration] = useState<number>();

    useEffect(() => {
      if (isStreaming) {
        if (startTime.current === null) {
          startTime.current = Date.now();
        }
        if (!hasUserToggled.current) {
          setAutomaticOpen(true);
        }
      } else if (startTime.current !== null) {
        setMeasuredDuration(Math.round((Date.now() - startTime.current) / 1000));
        startTime.current = null;
        if (!hasUserToggled.current) {
          setAutomaticOpen(false);
        }
      }
    }, [isStreaming]);

    const handleOpenChange = (newOpen: boolean) => {
      hasUserToggled.current = true;
      setIsOpen(newOpen);
    };

    return (
      <ReasoningContext.Provider
        value={{ isStreaming, isOpen, setIsOpen: handleOpenChange, duration: duration ?? measuredDuration }}
      >
        <Trace className="not-prose">
          <TraceCollapsible
            className={cn("group", className)}
            onOpenChange={handleOpenChange}
            open={isOpen}
            {...props}
          >
            {children}
          </TraceCollapsible>
        </Trace>
      </ReasoningContext.Provider>
    );
  },
);

export type ReasoningTriggerProps = ComponentProps<typeof Collapsible.Trigger> & {
  getThinkingMessage?: (isStreaming: boolean) => ReactNode;
  showArrow?: boolean;
};

export const ReasoningTrigger = memo(
  ({ className, children, getThinkingMessage, showArrow, ...props }: ReasoningTriggerProps) => {
    const { isStreaming, duration } = useReasoning();

    return (
      <TraceCollapsibleTrigger
        className={cn(!showArrow && "[&>[data-slot=trace-icon]]:hidden", className)}
        {...props}
      >
        {children ?? (
          <TraceLine status={isStreaming ? "running" : undefined}>
            <TraceIcon>
              <BrainIcon />
            </TraceIcon>
            <TraceTitle>
              {getThinkingMessage
                ? getThinkingMessage(isStreaming)
                : isStreaming
                  ? "Thinking"
                  : duration === undefined
                    ? "Thought"
                    : `Thought for ${duration}s`}
            </TraceTitle>
          </TraceLine>
        )}
      </TraceCollapsibleTrigger>
    );
  },
);

export type ReasoningContentProps = ComponentProps<typeof Collapsible.Panel> & {
  children: string;
};

export const ReasoningContent = memo(({ className, children, ...props }: ReasoningContentProps) => {
  return (
    <TraceCollapsibleContent className={cn("text-sm", className)} {...props}>
      {/* eslint-disable-next-line jsx-a11y/aria-role -- Streamdown uses role as a message-domain prop. */}
      <StreamDownWrapper className="w-full max-w-none" role="assistant">
        {children}
      </StreamDownWrapper>
    </TraceCollapsibleContent>
  );
});

Reasoning.displayName = "Reasoning";
ReasoningTrigger.displayName = "ReasoningTrigger";
ReasoningContent.displayName = "ReasoningContent";
