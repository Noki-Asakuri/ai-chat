import type { ReactNode } from "react";
import { BellRingIcon, BoltIcon, CodeXmlIcon, KeyboardIcon, MonitorUpIcon, WrapTextIcon } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Item, ItemActions, ItemContent, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

import type { SendPreference } from "@/lib/chat/send-preference";

export type BehaviorOptionsCardProps = {
  disabled: boolean;
  autoWrap: boolean;
  performanceEnabled: boolean;
  showFullCode: boolean;
  sendPreference: SendPreference;
  notificationSound: boolean;
  desktopNotification: boolean;
  onSendPreferenceChange: (nextPreference: SendPreference) => void;
  onNotificationSoundChange: (enabled: boolean) => void;
  onDesktopNotificationChange: (enabled: boolean) => Promise<boolean> | boolean;
  onAutoWrapChange: (enabled: boolean) => void;
  onPerformanceEnabledChange: (enabled: boolean) => void;
  onShowFullCodeChange: (enabled: boolean) => void;
  onBehaviorChange: () => void;
};

type ToggleRowProps = {
  id: string;
  title: string;
  description: string;
  icon: typeof BellRingIcon;
  children: ReactNode;
};

function ToggleRow(props: ToggleRowProps) {
  const Icon = props.icon;

  return (
    <Item className="items-start rounded-none border-0 px-5 py-4 sm:flex-nowrap sm:items-center">
      <ItemMedia variant="icon" className="mt-0.5 rounded-md bg-muted p-2 text-muted-foreground">
        <Icon />
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle className="text-sm">
          <label htmlFor={props.id}>{props.title}</label>
        </ItemTitle>
        <p className="max-w-2xl text-xs/relaxed text-pretty text-muted-foreground">{props.description}</p>
      </ItemContent>
      <ItemActions className="basis-full justify-end sm:basis-auto">{props.children}</ItemActions>
    </Item>
  );
}

function isSendPreference(value: string): value is SendPreference {
  return value === "enter" || value === "ctrlEnter";
}

export function BehaviorOptionsCard(props: BehaviorOptionsCardProps) {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b px-5 py-4">
        <CardTitle>Interaction</CardTitle>
        <CardDescription>Control how chat input, notifications, and code behave.</CardDescription>
      </CardHeader>

      <CardContent className="p-0">
        <ToggleRow
          id="send-preference"
          title="How to send messages"
          description="Choose the keyboard shortcut used to send a message."
          icon={KeyboardIcon}
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
            <SelectTrigger
              id="send-preference"
              className="w-max max-w-full min-w-max"
              aria-label="Send preference"
            >
              <div className="flex items-center gap-2 text-left">
                <span>
                  {props.sendPreference === "ctrlEnter"
                    ? "Press Ctrl + Enter to send"
                    : "Press Enter to send"}
                </span>
              </div>
            </SelectTrigger>

            <SelectContent className="bg-card">
              <SelectGroup>
                <SelectItem value="enter">
                  <span>Press Enter to send</span>
                </SelectItem>
                <SelectItem value="ctrlEnter">
                  <span>Press Ctrl + Enter to send</span>
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </ToggleRow>

        <Separator className="-mx-4" />

        <ToggleRow
          id="notification-sound"
          title="Play chat completion sound"
          description="Play a sound when a response finishes or fails."
          icon={BellRingIcon}
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
          icon={MonitorUpIcon}
        >
          <Switch
            id="desktop-notification"
            disabled={props.disabled}
            checked={props.desktopNotification}
            onCheckedChange={(checked) => {
              void Promise.resolve(props.onDesktopNotificationChange(checked)).then((shouldSave) => {
                if (shouldSave) {
                  props.onBehaviorChange();
                }
              });
            }}
            aria-label="Desktop notifications"
          />
        </ToggleRow>

        <Separator className="-mx-4" />

        <ToggleRow
          id="auto-wrap"
          title="Wrap long code lines"
          description="Wrap code blocks instead of scrolling horizontally."
          icon={WrapTextIcon}
        >
          <Switch
            id="auto-wrap"
            disabled={props.disabled}
            checked={props.autoWrap}
            onCheckedChange={(checked) => {
              props.onAutoWrapChange(checked);
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
          icon={BoltIcon}
        >
          <Switch
            id="performance-mode"
            disabled={props.disabled}
            checked={props.performanceEnabled}
            onCheckedChange={(checked) => {
              props.onPerformanceEnabledChange(checked);
              props.onBehaviorChange();
            }}
            aria-label="Performance mode"
          />
        </ToggleRow>

        <Separator className="-mx-4" />

        <ToggleRow
          id="show-full-code"
          title="Show full code by default"
          description="Expand code blocks by default instead of clamping them."
          icon={CodeXmlIcon}
        >
          <Switch
            id="show-full-code"
            disabled={props.disabled}
            checked={props.showFullCode}
            onCheckedChange={(checked) => {
              props.onShowFullCodeChange(checked);
              props.onBehaviorChange();
            }}
            aria-label="Show full code by default"
          />
        </ToggleRow>
      </CardContent>
    </Card>
  );
}
