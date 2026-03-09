import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { useEffect, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

type LocalConfig = {
  pref: "enter" | "ctrlEnter";
  wrapline: boolean;
};

export type BehaviorOptionsCardProps = {
  disabled: boolean;
  defaultPerformanceEnabled: boolean;
  defaultShowFullCode: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readLocalConfig(): LocalConfig {
  const defaults: LocalConfig = { pref: "enter", wrapline: false };

  if (typeof window === "undefined") return defaults;

  const raw = localStorage.getItem("local-config-store");
  if (!raw) return defaults;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return defaults;

    const stateUnknown = parsed["state"];
    if (!isRecord(stateUnknown)) return defaults;

    const prefValue = stateUnknown["pref"];
    const pref = prefValue === "ctrlEnter" ? "ctrlEnter" : "enter";

    const wraplineValue = stateUnknown["wrapline"];
    const wrapline = typeof wraplineValue === "boolean" ? wraplineValue : defaults.wrapline;

    return { pref, wrapline };
  } catch {
    return defaults;
  }
}

function patchLocalConfig(patch: Partial<LocalConfig>): void {
  if (typeof window === "undefined") return;

  const raw = localStorage.getItem("local-config-store");
  if (!raw) {
    localStorage.setItem("local-config-store", JSON.stringify({ state: patch, version: 0 }));
    return;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      localStorage.setItem("local-config-store", JSON.stringify({ state: patch, version: 0 }));
      return;
    }

    const prevStateUnknown = parsed["state"];
    const prevState = isRecord(prevStateUnknown) ? prevStateUnknown : {};

    const next: Record<string, unknown> = {
      ...parsed,
      state: { ...prevState, ...patch },
    };

    localStorage.setItem("local-config-store", JSON.stringify(next));
  } catch {
    localStorage.setItem("local-config-store", JSON.stringify({ state: patch, version: 0 }));
  }
}

type ToggleRowProps = {
  id: string;
  name: string;
  title: string;
  description: string;
  disabled: boolean;
  children: ReactNode;
};

function ToggleRow(props: ToggleRowProps) {
  return (
    <div className="flex items-start justify-between gap-6 py-4">
      <div className="min-w-0 space-y-1">
        <Label htmlFor={props.id} className="text-sm leading-none font-medium">
          {props.title}
        </Label>
        <p className="text-sm text-muted-foreground">{props.description}</p>
      </div>

      {props.children}
    </div>
  );
}

function ControlledSwitch({
  defaultChecked,
  onCheckedChange,
  ...props
}: ComponentPropsWithoutRef<typeof Switch> & {
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}) {
  const [value, setValue] = useState(defaultChecked ?? false);

  useEffect(() => {
    setValue(defaultChecked ?? false);
  }, [defaultChecked]);

  return (
    <Switch
      checked={value}
      onCheckedChange={(checked) => {
        setValue(checked);
        onCheckedChange?.(checked);
      }}
      {...props}
    />
  );
}

export function BehaviorOptionsCard(props: BehaviorOptionsCardProps) {
  const [localWrapline, setLocalWrapline] = useState<boolean>(false);
  const [localSendPref, setLocalSendPref] = useState<LocalConfig["pref"]>("enter");

  useEffect(() => {
    const config = readLocalConfig();
    setLocalWrapline(config.wrapline);
    setLocalSendPref(config.pref);
  }, []);

  return (
    <Card className="rounded-md">
      <CardHeader>
        <CardTitle>Behavior options</CardTitle>
        <CardDescription>Toggle how the interface behaves for you.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-0">
        <ToggleRow
          id="invert-send-newline"
          name="invert-send-newline"
          title="Invert send/new line behavior"
          description="When enabled, use Enter for new lines, and Ctrl/Command + Enter to send messages. When disabled, use Enter to send and Shift + Enter for new lines."
          disabled={props.disabled}
        >
          <Switch
            id="invert-send-newline"
            name="invert-send-newline"
            disabled={props.disabled}
            checked={localSendPref === "ctrlEnter"}
            onCheckedChange={(checked) => {
              const nextPref: LocalConfig["pref"] = checked ? "ctrlEnter" : "enter";
              setLocalSendPref(nextPref);
              patchLocalConfig({ pref: nextPref });
            }}
            aria-label="Invert send/new line behavior"
          />
        </ToggleRow>

        <Separator className="-mx-4" />

        <ToggleRow
          id="auto-wrap"
          name="auto-wrap"
          title="Wrap long code lines"
          description="Wrap code blocks instead of scrolling horizontally."
          disabled={props.disabled}
        >
          <Switch
            id="auto-wrap"
            name="auto-wrap"
            disabled={props.disabled}
            checked={localWrapline}
            onCheckedChange={(checked) => {
              setLocalWrapline(checked);
              patchLocalConfig({ wrapline: checked });
            }}
            aria-label="Wrap long code lines"
          />
        </ToggleRow>

        <Separator className="-mx-4" />

        <ToggleRow
          id="performance-mode"
          name="performance-mode"
          title="Performance mode"
          description="Turn on the performance mode (can improve readability)."
          disabled={props.disabled}
        >
          <ControlledSwitch
            id="performance-mode"
            name="performance-mode"
            disabled={props.disabled}
            defaultChecked={props.defaultPerformanceEnabled}
            aria-label="Performance mode"
          />
        </ToggleRow>

        <Separator className="-mx-4" />

        <ToggleRow
          id="show-full-code"
          name="show-full-code"
          title="Show full code by default"
          description="Expand code blocks by default instead of clamping them."
          disabled={props.disabled}
        >
          <ControlledSwitch
            id="show-full-code"
            name="show-full-code"
            disabled={props.disabled}
            defaultChecked={props.defaultShowFullCode}
            aria-label="Show full code by default"
          />
        </ToggleRow>
      </CardContent>
    </Card>
  );
}
