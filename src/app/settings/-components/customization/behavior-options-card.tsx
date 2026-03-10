import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { useEffect, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

import type { SendPreference } from "@/lib/chat/send-preference";

export type BehaviorOptionsCardProps = {
  disabled: boolean;
  defaultAutoWrap: boolean;
  defaultPerformanceEnabled: boolean;
  defaultShowFullCode: boolean;
  sendPreference: SendPreference;
  notificationSound: boolean;
  desktopNotification: boolean;
  onSendPreferenceChange: (nextPreference: SendPreference) => void;
  onNotificationSoundChange: (enabled: boolean) => void;
  onDesktopNotificationChange: (enabled: boolean) => Promise<boolean> | boolean;
  onBehaviorChange: () => void;
};

type ToggleRowProps = {
  id: string;
  title: string;
  description: string;
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

function isSendPreference(value: string): value is SendPreference {
  return value === "enter" || value === "ctrlEnter";
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
  const [autoWrap, setAutoWrap] = useState<boolean>(props.defaultAutoWrap);

  useEffect(() => {
    setAutoWrap(props.defaultAutoWrap);
  }, [props.defaultAutoWrap]);

  return (
    <Card className="rounded-md">
      <CardHeader>
        <CardTitle>Behavior options</CardTitle>
        <CardDescription>Toggle how the interface behaves for you.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-0">
        <ToggleRow
          id="send-preference"
          title="How to send messages"
          description="Choose the keyboard shortcut used to send a message."
        >
          <Select
            value={props.sendPreference}
            disabled={props.disabled}
            onValueChange={(value) => {
              if (!value || !isSendPreference(value)) return;

              props.onSendPreferenceChange(value);
              props.onBehaviorChange();
            }}
          >
            <SelectTrigger id="send-preference" className="w-[240px]" aria-label="Send preference">
              <div className="flex min-w-0 flex-1 items-center gap-2 text-left">
                <span className="truncate">
                  {props.sendPreference === "ctrlEnter"
                    ? "Press Ctrl + Enter to send"
                    : "Press Enter to send"}
                </span>
              </div>
            </SelectTrigger>

            <SelectContent className="bg-card">
              <SelectItem value="enter">
                <span>Press Enter to send</span>
              </SelectItem>
              <SelectItem value="ctrlEnter">
                <span>Press Ctrl + Enter to send</span>
              </SelectItem>
            </SelectContent>
          </Select>
        </ToggleRow>

        <Separator className="-mx-4" />

        <ToggleRow
          id="notification-sound"
          title="Play chat completion sound"
          description="Play a sound when a response finishes or fails."
        >
          <Switch
            id="notification-sound"
            disabled={props.disabled}
            checked={props.notificationSound}
            onCheckedChange={(checked) => {
              props.onNotificationSoundChange(checked);
              props.onBehaviorChange();
            }}
            aria-label="Play chat completion sound"
          />
        </ToggleRow>

        <Separator className="-mx-4" />

        <ToggleRow
          id="desktop-notification"
          title="Desktop notifications"
          description="Show browser notifications when responses finish or fail in background tabs."
        >
          <Switch
            id="desktop-notification"
            disabled={props.disabled}
            checked={props.desktopNotification}
            onCheckedChange={(checked) => {
              void Promise.resolve(props.onDesktopNotificationChange(checked)).then(
                (shouldSave) => {
                  if (shouldSave) {
                    props.onBehaviorChange();
                  }
                },
              );
            }}
            aria-label="Desktop notifications"
          />
        </ToggleRow>

        <Separator className="-mx-4" />

        <ToggleRow
          id="auto-wrap"
          title="Wrap long code lines"
          description="Wrap code blocks instead of scrolling horizontally."
        >
          <Switch
            id="auto-wrap"
            name="auto-wrap"
            disabled={props.disabled}
            checked={autoWrap}
            onCheckedChange={(checked) => {
              setAutoWrap(checked);
              props.onBehaviorChange();
            }}
            aria-label="Wrap long code lines"
          />
        </ToggleRow>

        <Separator className="-mx-4" />

        <ToggleRow
          id="performance-mode"
          title="Performance mode"
          description="Turn on the performance mode (can improve readability)."
        >
          <ControlledSwitch
            id="performance-mode"
            name="performance-mode"
            disabled={props.disabled}
            defaultChecked={props.defaultPerformanceEnabled}
            onCheckedChange={() => props.onBehaviorChange()}
            aria-label="Performance mode"
          />
        </ToggleRow>

        <Separator className="-mx-4" />

        <ToggleRow
          id="show-full-code"
          title="Show full code by default"
          description="Expand code blocks by default instead of clamping them."
        >
          <ControlledSwitch
            id="show-full-code"
            name="show-full-code"
            disabled={props.disabled}
            defaultChecked={props.defaultShowFullCode}
            onCheckedChange={() => props.onBehaviorChange()}
            aria-label="Show full code by default"
          />
        </ToggleRow>
      </CardContent>
    </Card>
  );
}
