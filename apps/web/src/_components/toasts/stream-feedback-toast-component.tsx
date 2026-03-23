import { ArrowRightIcon, CircleCheckIcon, TriangleAlertIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
    <div className="flex w-full max-w-100 min-w-0 flex-col gap-3">
      <div className="flex items-start gap-3">
        <StatusIcon
          className={cn(
            "mt-0.5 size-4 shrink-0",
            props.status === "success" ? "text-emerald-400" : "text-amber-400",
          )}
        />

        <div className="min-w-0 space-y-1.5">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                "min-w-min rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wide",
                props.status === "success"
                  ? "bg-emerald-500/12 text-emerald-300"
                  : "bg-amber-500/12 text-amber-300",
              )}
            >
              {statusLabel}
            </span>
          </div>

          <p className="truncate text-sm leading-none font-medium">{props.threadTitle}</p>
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
