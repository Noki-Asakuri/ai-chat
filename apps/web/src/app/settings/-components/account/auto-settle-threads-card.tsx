import { api } from "@ai-chat/backend/convex/_generated/api";

import { useMutation } from "convex/react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "@/components/ui/toast";

import { SettingsSection } from "@/components/settings/settings-section";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
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
  const lastEnabledDaysRef = useRef(props.initialDays > 0 ? props.initialDays : DEFAULT_AUTO_SETTLE_DAYS);

  useEffect(() => {
    setDays(props.initialDays);
    setDaysInput(String(props.initialDays));
    if (props.initialDays > 0) lastEnabledDaysRef.current = props.initialDays;
  }, [props.initialDays]);

  function saveDays(nextDays: number) {
    const previousDays = days;
    setDays(nextDays);
    setDaysInput(String(nextDays));
    if (nextDays > 0) lastEnabledDaysRef.current = nextDays;

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
    <SettingsSection
      id="automatic-thread-settling"
      title="Automatic settling"
      description="Settle inactive completed or failed threads automatically."
    >
      <Field className="grid gap-4 py-5 md:grid-cols-[minmax(12rem,1fr)_auto] md:items-center md:gap-x-8">
        <FieldContent>
          <FieldLabel htmlFor="auto-settle-threads">Auto-settle inactive threads</FieldLabel>
          <FieldDescription>
            Sidebar threads with no activity for the configured number of days settle automatically.
          </FieldDescription>
        </FieldContent>
        <Switch
          id="auto-settle-threads"
          checked={days > 0}
          disabled={controlsDisabled}
          onCheckedChange={(checked) => saveDays(checked ? lastEnabledDaysRef.current : 0)}
          aria-label="Auto-settle inactive threads"
        />
      </Field>

      {days > 0 && (
        <>
          <Separator />

          <Field className="grid gap-4 py-5 md:grid-cols-[minmax(12rem,1fr)_8rem] md:items-center md:gap-x-8">
            <FieldContent>
              <FieldLabel htmlFor="auto-settle-days">Days of inactivity before auto-settle</FieldLabel>
              <FieldDescription>
                Enter a whole number from 0 to 90. Set to 0 to disable auto-settle.
              </FieldDescription>
            </FieldContent>
            <Input
              id="auto-settle-days"
              type="number"
              inputMode="numeric"
              min={0}
              max={MAX_AUTO_SETTLE_DAYS}
              step={1}
              value={daysInput}
              disabled={controlsDisabled}
              onValueChange={setDaysInput}
              onBlur={commitDaysInput}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
              aria-label="Days of inactivity before auto-settle"
            />
          </Field>
        </>
      )}
    </SettingsSection>
  );
}
