import { CheckIcon, MonitorIcon, MoonIcon, PipetteIcon, SunIcon } from "lucide-react";
import {
  ColorPicker,
  ColorPickerArea,
  ColorPickerAreaThumb,
  ColorPickerEyeDropper,
  ColorPickerInput,
  ColorPickerSlider,
  ColorPickerSliderThumb,
  ColorPickerSwatch,
} from "@ui-sdk/react/color-picker";
import { useEffect, useEffectEvent, useRef, type ReactNode } from "react";

import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
const RAINBOW = "conic-gradient(from 0deg, #f87171, #fbbf24, #34d399, #22d3ee, #818cf8, #e879f9, #f87171)";

const THUMB_CLASS =
  "size-4 -translate-1/2 rounded-full border-2 border-white bg-(--color-picker-color) shadow-sm ring-1 ring-black/25 outline-none focus-visible:ring-2 focus-visible:ring-ring";

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
                    onSelect={() => props.onAccentChange(preset.value)}
                  />
                );
              })}
            </div>

            <Popover>
              <PopoverTrigger
                disabled={props.disabled}
                aria-label="Custom accent color"
                title="Custom color"
                className={cn(
                  "relative flex size-8 cursor-pointer items-center justify-center rounded-full ring-1 ring-foreground/15 ring-offset-2 ring-offset-background outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                  customAccent && "ring-2 ring-foreground",
                )}
                style={{ background: customAccent ?? RAINBOW }}
              >
                {customAccent ? (
                  <CheckIcon aria-hidden className="size-4 text-white mix-blend-difference" />
                ) : (
                  <PipetteIcon aria-hidden className="size-3.5 text-white drop-shadow" />
                )}
              </PopoverTrigger>
              <PopoverContent align="start" className="w-60 gap-3 p-3">
                <CustomAccentPicker
                  initialColor={props.accent ?? DEFAULT_CUSTOM_ACCENT}
                  onAccentChange={props.onAccentChange}
                />
              </PopoverContent>
            </Popover>

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

/**
 * Drag steps preview the accent across the app at most once per frame, without React state, the
 * form or autosave; the color is saved once per interaction, when the picker commits it. Mounted
 * only while the popover is open, so each open starts from the current accent.
 */
function CustomAccentPicker(props: { initialColor: string; onAccentChange: (accent: string) => void }) {
  const draftRef = useRef<string | null>(null);
  const frameRef = useRef<number | null>(null);

  function paintDraft() {
    frameRef.current = null;
    if (draftRef.current) previewAccent(document.documentElement, draftRef.current);
  }

  function preview(value: string) {
    if (!isHexColor(value)) return;
    draftRef.current = value.toLowerCase();
    frameRef.current ??= requestAnimationFrame(paintDraft);
  }

  function commit(value?: string) {
    if (value && isHexColor(value)) draftRef.current = value.toLowerCase();
    const pending = draftRef.current;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    draftRef.current = null;
    if (!pending) return;
    endAccentPreview(document.documentElement, { accent: pending });
    props.onAccentChange(pending);
  }

  const commitOnUnmount = useEffectEvent(() => commit());
  // Closing the popover or leaving the page mid-drag keeps the last color.
  useEffect(() => () => commitOnUnmount(), []);

  return (
    <ColorPicker
      aria-label="Custom accent color"
      format="hex"
      defaultValue={props.initialColor}
      onValueChange={preview}
      onValueCommit={commit}
      className="flex flex-col gap-3"
    >
      <ColorPickerArea className="relative h-36 w-full touch-none rounded-md [background:var(--color-area-background)]">
        <ColorPickerAreaThumb className={THUMB_CLASS} />
      </ColorPickerArea>
      <ColorPickerSlider
        channel="hue"
        className="relative h-3 w-full touch-none rounded-full [background:var(--color-slider-background)]"
      >
        <ColorPickerSliderThumb className={cn(THUMB_CLASS, "top-1/2")} />
      </ColorPickerSlider>
      <div className="flex items-center gap-2">
        <ColorPickerSwatch className="size-8 shrink-0 rounded-md bg-(--color-picker-color) ring-1 ring-foreground/15" />
        <ColorPickerInput
          aria-label="Hex color"
          spellCheck={false}
          autoComplete="off"
          className="h-8 w-full min-w-0 rounded-md border border-input bg-transparent px-2.5 font-mono text-xs tabular-nums outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 dark:bg-input/30"
        />
        <ColorPickerEyeDropper
          aria-label="Pick a color from the screen"
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring data-unsupported:hidden"
        >
          <PipetteIcon aria-hidden className="size-4" />
        </ColorPickerEyeDropper>
      </div>
    </ColorPicker>
  );
}
