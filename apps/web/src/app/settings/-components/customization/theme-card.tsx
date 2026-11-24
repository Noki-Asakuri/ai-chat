import { CheckIcon, MonitorIcon, MoonIcon, PipetteIcon, SunIcon } from "lucide-react";
import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react";

import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import {
  ACCENT_PRESETS,
  endAccentPreview,
  isHexColor,
  previewAccent,
  type ThemeMode,
} from "@/lib/appearance/theme";
import { cn } from "@/lib/utils";

const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon },
] as const satisfies ReadonlyArray<{ value: ThemeMode; label: string; icon: typeof SunIcon }>;

const DEFAULT_CUSTOM_ACCENT = "#8b7cf6";

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
  const customAccent = !isPresetAccent && props.accent ? props.accent : null;

  /**
   * The native picker fires on every drag movement. Each step previews the accent across the app
   * without React: at most once per frame it writes the swatch, hex label and <html> accent
   * variables, with transitions off. The form, autosave and React state take the color once, when
   * the picker commits (closes).
   */
  const draftRef = useRef<string | null>(null);
  const frameRef = useRef<number | null>(null);
  const swatchRef = useRef<HTMLLabelElement>(null);
  const hexRef = useRef<HTMLSpanElement>(null);
  // Remounts the picker to drop a previewed-but-uncommitted color from the DOM.
  const [pickerKey, setPickerKey] = useState(0);

  function paintDraftAccent() {
    frameRef.current = null;
    const accent = draftRef.current;
    if (!accent) return;
    previewAccent(document.documentElement, accent);
    if (swatchRef.current) swatchRef.current.style.background = accent;
    if (hexRef.current) {
      hexRef.current.textContent = accent;
      hexRef.current.hidden = false;
    }
  }

  function previewDraftAccent(accent: string) {
    draftRef.current = accent;
    frameRef.current ??= requestAnimationFrame(paintDraftAccent);
  }

  function cancelDraftFrame() {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  }

  function commitDraftAccent() {
    const pending = draftRef.current;
    if (!pending) return;
    cancelDraftFrame();
    paintDraftAccent();
    draftRef.current = null;
    endAccentPreview(document.documentElement);
    // Remount so the swatch and hex label drop the direct DOM writes and match React again
    // (e.g. a dragged color that equals a preset leaves the custom swatch's props unchanged).
    setPickerKey((key) => key + 1);
    props.onAccentChange(pending);
  }

  // The uncontrolled picker's React onChange is the native `input` event (every movement);
  // the native `change` event fires once, on commit.
  function attachPicker(picker: HTMLInputElement) {
    picker.addEventListener("change", commitDraftAccent);
    return () => picker.removeEventListener("change", commitDraftAccent);
  }

  const onPickerCommit = useEffectEvent(commitDraftAccent);
  // Leaving the page with the picker still open keeps the last color.
  useEffect(() => () => onPickerCommit(), []);

  function selectPresetAccent(accent: string | null) {
    if (draftRef.current) {
      cancelDraftFrame();
      draftRef.current = null;
      // Put the chosen accent back on <html> in case the saved value doesn't change.
      endAccentPreview(document.documentElement, { accent });
      setPickerKey((key) => key + 1);
    }
    props.onAccentChange(accent);
  }

  return (
    <div>
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
                const selected = preset.value === props.accent;
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

            <span key={pickerKey} className="contents">
              <label
                ref={swatchRef}
                className={cn(
                  "relative flex size-8 cursor-pointer items-center justify-center rounded-full ring-1 ring-foreground/15 ring-offset-2 ring-offset-background focus-within:ring-2 focus-within:ring-ring has-disabled:cursor-not-allowed has-disabled:opacity-50",
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
                  ref={attachPicker}
                  type="color"
                  className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                  disabled={props.disabled}
                  defaultValue={customAccent ?? DEFAULT_CUSTOM_ACCENT}
                  onChange={(event) => {
                    const value = event.target.value.toLowerCase();
                    if (isHexColor(value)) previewDraftAccent(value);
                  }}
                />
                {customAccent ? (
                  <CheckIcon aria-hidden className="size-4 text-white mix-blend-difference" />
                ) : (
                  <PipetteIcon aria-hidden className="size-3.5 text-white drop-shadow" />
                )}
              </label>

              <span
                ref={hexRef}
                hidden={!customAccent}
                className="font-mono text-xs text-muted-foreground tabular-nums"
              >
                {customAccent ?? ""}
              </span>
            </span>
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
    </div>
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
