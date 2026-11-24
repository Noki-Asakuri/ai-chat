import { CheckIcon, MonitorIcon, MoonIcon, PipetteIcon, SunIcon } from "lucide-react";
import { useThrottler } from "@tanstack/react-pacer";
import { useState, type ReactNode } from "react";

import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { ACCENT_PRESETS, isHexColor, type ThemeMode } from "@/lib/appearance/theme";
import { cn } from "@/lib/utils";

const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon },
] as const satisfies ReadonlyArray<{ value: ThemeMode; label: string; icon: typeof SunIcon }>;

const DEFAULT_CUSTOM_ACCENT = "#8b7cf6";

/**
 * The native picker fires on every drag movement, and each accent change re-themes the whole
 * page. Commit at most this often while dragging; the swatch itself follows the drag locally.
 */
const CUSTOM_ACCENT_COMMIT_MS = 120;

export type ThemeCardProps = {
  disabled: boolean;
  theme: ThemeMode;
  accent: string | null;
  tint: number;
  onThemeChange: (theme: ThemeMode) => void;
  onAccentChange: (accent: string | null) => void;
  onTintChange: (tint: number) => void;
};

function SettingRow(props: { id: string; title: string; description: string; children: ReactNode }) {
  return (
    <div className="grid gap-4 py-5 md:grid-cols-[minmax(12rem,0.7fr)_minmax(18rem,1fr)] md:items-center md:gap-x-8">
      <div className="flex min-w-0 flex-col gap-1">
        <p id={`${props.id}-label`} className="text-sm font-medium">
          {props.title}
        </p>
        <p className="text-xs/relaxed text-pretty text-muted-foreground">{props.description}</p>
      </div>
      <div className="min-w-0">{props.children}</div>
    </div>
  );
}

export function ThemeCard(props: ThemeCardProps) {
  const isPresetAccent = ACCENT_PRESETS.some((preset) => preset.value === props.accent);
  const savedCustomAccent = !isPresetAccent && props.accent ? props.accent : null;

  // The color under the picker while dragging, until the throttled commit catches up.
  const [draftAccent, setDraftAccent] = useState<string | null>(null);
  const customAccent = draftAccent ?? savedCustomAccent;
  const accentCommitter = useThrottler(
    (accent: string) => {
      props.onAccentChange(accent);
      setDraftAccent((current) => (current === accent ? null : current));
    },
    // Leaving the page mid-drag still saves the last color.
    { wait: CUSTOM_ACCENT_COMMIT_MS, onUnmount: (throttler) => throttler.flush() },
  );

  function selectPresetAccent(accent: string | null) {
    // Drop a pending custom color so it can't land after the preset.
    accentCommitter.cancel();
    setDraftAccent(null);
    props.onAccentChange(accent);
  }

  return (
    <SettingsSection
      id="theme"
      title="Theme"
      description="Choose light or dark, pick an accent color, and decide how much it tints the interface."
    >
      <SettingRow
        id="theme-mode"
        title="Mode"
        description="System follows your device's light or dark setting."
      >
        <ToggleGroup
          aria-labelledby="theme-mode-label"
          variant="outline"
          disabled={props.disabled}
          value={[props.theme]}
          onValueChange={(values) => {
            const next = THEME_OPTIONS.find((option) => option.value === values[0]);
            if (next) props.onThemeChange(next.value);
          }}
        >
          {THEME_OPTIONS.map((option) => (
            <ToggleGroupItem key={option.value} value={option.value} className="gap-1.5 px-3!">
              <option.icon aria-hidden />
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </SettingRow>

      <Separator />

      <SettingRow
        id="theme-accent"
        title="Accent color"
        description="Used for buttons, highlights, selection, and focus rings."
      >
        <div className="flex flex-wrap items-center gap-2">
          <div role="radiogroup" aria-labelledby="theme-accent-label" className="contents">
            {ACCENT_PRESETS.map((preset) => {
              const selected = draftAccent === null && preset.value === props.accent;
              return (
                <AccentSwatch
                  key={preset.name}
                  label={preset.name}
                  color={preset.swatch}
                  selected={selected}
                  disabled={props.disabled}
                  onSelect={() => selectPresetAccent(preset.value)}
                />
              );
            })}
          </div>

          <label
            className={cn(
              "relative flex size-8 cursor-pointer items-center justify-center rounded-full ring-1 ring-foreground/15 ring-offset-2 ring-offset-background transition-shadow focus-within:ring-2 focus-within:ring-ring has-disabled:cursor-not-allowed has-disabled:opacity-50",
              customAccent && "ring-2 ring-foreground",
            )}
            style={{
              background:
                customAccent ??
                "conic-gradient(from 0deg, #f87171, #fbbf24, #34d399, #22d3ee, #818cf8, #e879f9, #f87171)",
            }}
            title="Custom color"
          >
            <span className="sr-only">Custom accent color</span>
            <input
              type="color"
              className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
              disabled={props.disabled}
              value={customAccent ?? DEFAULT_CUSTOM_ACCENT}
              onChange={(event) => {
                const value = event.target.value.toLowerCase();
                if (!isHexColor(value)) return;
                setDraftAccent(value);
                accentCommitter.maybeExecute(value);
              }}
            />
            {customAccent ? (
              <CheckIcon aria-hidden className="size-4 text-white mix-blend-difference" />
            ) : (
              <PipetteIcon aria-hidden className="size-3.5 text-white drop-shadow" />
            )}
          </label>

          {customAccent && (
            <span className="font-mono text-xs text-muted-foreground tabular-nums">{customAccent}</span>
          )}
        </div>
      </SettingRow>

      <Separator />

      <SettingRow
        id="theme-tint"
        title="Surface tint"
        description="Blends the accent into backgrounds, sidebars, and cards. 0% keeps them neutral."
      >
        <div className="flex items-center gap-4">
          <Slider
            min={0}
            max={100}
            step={5}
            disabled={props.disabled}
            value={[props.tint]}
            getAriaLabel={() => "Surface tint"}
            onValueChange={(value) => props.onTintChange(Array.isArray(value) ? (value[0] ?? 0) : value)}
          />
          <span className="w-10 shrink-0 text-right text-sm text-muted-foreground tabular-nums">
            {props.tint}%
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={props.disabled || props.tint === 0}
            onClick={() => props.onTintChange(0)}
          >
            Reset
          </Button>
        </div>
      </SettingRow>
    </SettingsSection>
  );
}

function AccentSwatch(props: {
  label: string;
  color: string;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      title={props.label}
      className={cn(
        "flex size-8 cursor-pointer items-center justify-center rounded-full ring-1 ring-foreground/15 ring-offset-2 ring-offset-background transition-shadow has-focus-visible:ring-2 has-focus-visible:ring-ring has-disabled:cursor-not-allowed has-disabled:opacity-50",
        props.selected && "ring-2 ring-foreground",
      )}
      style={{ background: props.color }}
    >
      <input
        type="radio"
        name="accent-color"
        className="sr-only"
        aria-label={props.label}
        checked={props.selected}
        disabled={props.disabled}
        onChange={props.onSelect}
      />
      {props.selected && <CheckIcon aria-hidden className="size-4 text-white mix-blend-difference" />}
    </label>
  );
}
