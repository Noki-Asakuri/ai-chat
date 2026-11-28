import { api } from "@ai-chat/backend/convex/_generated/api";

import { useMutation } from "convex/react";
import { TimerResetIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "@/components/ui/toast";

import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

const DEFAULT_AUTO_SETTLE_DAYS = 3;
const MAX_AUTO_SETTLE_DAYS = 90;

type AutoSettleThreadsCardProps = {
  disabled: boolean;
  initialDays: number;
};

export function AutoSettleThreadsCard(props: AutoSettleThreadsCardProps) {
  const updateUserPreferences = useMutation(api.functions.users.updateUserPreferences);
  const [days, setDays] = useState(props.initialDays);
  const [daysInput, setDaysInput] = useState(String(props.initialDays));
  const [pending, startTransition] = useTransition();
  const [lastEnabledDays, setLastEnabledDays] = useState(
    props.initialDays > 0 ? props.initialDays : DEFAULT_AUTO_SETTLE_DAYS,
  );

  function saveDays(nextDays: number) {
    const previousDays = days;
    setDays(nextDays);
    setDaysInput(String(nextDays));
    if (nextDays > 0) setLastEnabledDays(nextDays);

    startTransition(async () => {
      try {
        await updateUserPreferences({ data: { threads: { autoSettleDays: nextDays } } });
      } catch (error) {
        setDays(previousDays);
        setDaysInput(String(previousDays));
        toast.error("Failed to save auto-settle setting", {
          description: error instanceof Error ? error.message : "An unknown error occurred",
        });
      }
    });
  }

  function commitDaysInput() {
    if (daysInput.trim() === "") {
      setDaysInput(String(days));
      return;
    }

    const parsedDays = Number(daysInput);
    if (!Number.isFinite(parsedDays)) {
      setDaysInput(String(days));
      return;
    }

    const nextDays = Math.min(MAX_AUTO_SETTLE_DAYS, Math.max(0, Math.trunc(parsedDays)));
    if (nextDays === days) {
      setDaysInput(String(nextDays));
      return;
    }

    saveDays(nextDays);
  }

  const controlsDisabled = props.disabled || pending;

  return (
    <section
      aria-labelledby="automatic-thread-settling-heading"
      className="flex flex-col gap-4 rounded-lg border bg-card p-4"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
          <TimerResetIcon aria-hidden="true" className="size-4.5" />
        </span>
        <Field orientation="horizontal" className="min-w-0 flex-1 items-start justify-between gap-4">
          <FieldContent>
            <FieldLabel htmlFor="auto-settle-threads" id="automatic-thread-settling-heading" className="text-sm">
              Settle inactive threads automatically
            </FieldLabel>
            <FieldDescription>
              Completed or failed threads leave the sidebar once they have been quiet long enough.
            </FieldDescription>
          </FieldContent>
          <Switch
            id="auto-settle-threads"
            checked={days > 0}
            disabled={controlsDisabled}
            onCheckedChange={(checked) => saveDays(checked ? lastEnabledDays : 0)}
          />
        </Field>
      </div>

      <div
        data-enabled={days > 0}
        className="flex items-center gap-2 pl-12 text-sm text-muted-foreground data-[enabled=false]:opacity-50"
      >
        <label htmlFor="auto-settle-days">After</label>
        <Input
          id="auto-settle-days"
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_AUTO_SETTLE_DAYS}
          step={1}
          value={days > 0 ? daysInput : String(lastEnabledDays)}
          disabled={controlsDisabled || days === 0}
          onValueChange={setDaysInput}
          onBlur={commitDaysInput}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          className="h-8 w-16 text-center text-sm tabular-nums md:text-sm"
        />
        <span>days without activity (up to {MAX_AUTO_SETTLE_DAYS})</span>
      </div>
    </section>
  );
}
