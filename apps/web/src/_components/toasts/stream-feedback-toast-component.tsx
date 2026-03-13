"use client";

import { ArrowRightIcon, CircleCheckIcon, TriangleAlertIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

type StreamFeedbackToastComponentProps = {
  status: "success" | "error";
  threadTitle: string;
  description: string;
  onClose: () => void;
  onOpenThread: () => void;
};

export function StreamFeedbackToastComponent(props: StreamFeedbackToastComponentProps) {
  const StatusIcon = props.status === "success" ? CircleCheckIcon : TriangleAlertIcon;
  const statusLabel = props.status === "success" ? "Response ready" : "Response failed";

  return (
    <div className="flex max-w-80 min-w-0 flex-col gap-3">
      <div className="flex items-start gap-3">
        <StatusIcon
          className={
            props.status === "success"
              ? "mt-0.5 size-4 shrink-0 text-emerald-400"
              : "mt-0.5 size-4 shrink-0 text-amber-400"
          }
        />

        <div className="min-w-0 space-y-1.5">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={
                props.status === "success"
                  ? "rounded-full bg-emerald-500/12 px-2 py-0.5 text-[11px] font-medium tracking-wide text-emerald-300"
                  : "rounded-full bg-amber-500/12 px-2 py-0.5 text-[11px] font-medium tracking-wide text-amber-300"
              }
            >
              {statusLabel}
            </span>

            <p className="truncate text-sm leading-none font-medium">{props.threadTitle}</p>
          </div>

          <p className="text-sm leading-snug text-muted-foreground">{props.description}</p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={props.onClose}>
          <XIcon />
          Close
        </Button>

        <Button type="button" size="sm" onClick={props.onOpenThread}>
          <ArrowRightIcon />
          Open thread
        </Button>
      </div>
    </div>
  );
}
