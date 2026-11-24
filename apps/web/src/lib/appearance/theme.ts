import { useSyncExternalStore } from "react";

export type ThemeMode = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";
export type BlurMode = "messages" | "backdrop";

export type AppearancePreferences = {
  theme: ThemeMode;
  /** A 6-digit hex color, or null for the built-in accent. */
  accent: string | null;
  /** How strongly the accent tints surfaces, from 0 to 100. */
  tint: number;
  blurMode: BlurMode;
  /** Blur radius in pixels for the background image when `blurMode` is "backdrop". */
  backdropBlur: number;
};

export const DEFAULT_APPEARANCE: AppearancePreferences = {
  theme: "dark",
  accent: null,
  tint: 0,
  blurMode: "messages",
  backdropBlur: 24,
};

export const MAX_BACKDROP_BLUR = 64;
export const APPEARANCE_STORAGE_KEY = "ai-chat:appearance";

/** Surface tint at 100 mixes this much of the accent into the background. */
const MAX_TINT_PERCENT = 16;
const LIGHT_THEME_COLOR = "#fafafa";
const DARK_THEME_COLOR = "#0a0a0a";
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export const ACCENT_PRESETS = [
  { name: "Violet", value: null, swatch: "oklch(0.65 0.18 285)" },
  { name: "Rose", value: "#fb7185", swatch: "#fb7185" },
  { name: "Peach", value: "#f4a38c", swatch: "#f4a38c" },
  { name: "Amber", value: "#f59e0b", swatch: "#f59e0b" },
  { name: "Emerald", value: "#10b981", swatch: "#10b981" },
  { name: "Cyan", value: "#22d3ee", swatch: "#22d3ee" },
  { name: "Blue", value: "#3b82f6", swatch: "#3b82f6" },
  { name: "Graphite", value: "#a3a3a3", swatch: "#a3a3a3" },
] as const satisfies ReadonlyArray<{ name: string; value: string | null; swatch: string }>;

export function isHexColor(value: string): boolean {
  return HEX_COLOR.test(value);
}

export function normalizeAppearance(
  appearance: Partial<AppearancePreferences> | undefined,
): AppearancePreferences {
  const merged = { ...DEFAULT_APPEARANCE, ...appearance };
  return {
    theme: merged.theme === "light" || merged.theme === "system" ? merged.theme : "dark",
    accent: merged.accent && isHexColor(merged.accent) ? merged.accent.toLowerCase() : null,
    tint: clamp(merged.tint, 0, 100, DEFAULT_APPEARANCE.tint),
    blurMode: merged.blurMode === "backdrop" ? "backdrop" : "messages",
    backdropBlur: clamp(merged.backdropBlur, 0, MAX_BACKDROP_BLUR, DEFAULT_APPEARANCE.backdropBlur),
  };
}

function clamp(value: number, min: number, max: number, fallback: number) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function relativeLuminance(hex: string) {
  const channels = [1, 3, 5].map((index) => {
    const channel = Number.parseInt(hex.slice(index, index + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

/** Picks black or white text, whichever contrasts more with the accent. */
export function getAccentForeground(hex: string): string {
  const luminance = relativeLuminance(hex);
  const contrastWithBlack = (luminance + 0.05) / 0.05;
  const contrastWithWhite = 1.05 / (luminance + 0.05);
  return contrastWithBlack >= contrastWithWhite ? "#0a0a0a" : "#ffffff";
}

/** CSS custom properties set on <html>; an empty string removes the property. */
export function getAppearanceVariables(appearance: AppearancePreferences) {
  return {
    "--custom-primary": appearance.accent ?? "",
    "--custom-primary-foreground": appearance.accent ? getAccentForeground(appearance.accent) : "",
    "--surface-tint": `${((appearance.tint / 100) * MAX_TINT_PERCENT).toFixed(2)}%`,
  };
}

export function resolveTheme(theme: ThemeMode): ResolvedTheme {
  if (theme !== "system") return theme;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function applyResolvedTheme(root: HTMLElement, resolved: ResolvedTheme) {
  root.dataset.theme = resolved;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;

  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = resolved === "light" ? LIGHT_THEME_COLOR : DARK_THEME_COLOR;
}

function setAccentVariables(root: HTMLElement, accent: string | null) {
  if (accent) {
    root.style.setProperty("--custom-primary", accent);
    root.style.setProperty("--custom-primary-foreground", getAccentForeground(accent));
  } else {
    root.style.removeProperty("--custom-primary");
    root.style.removeProperty("--custom-primary-foreground");
  }
}

/**
 * Live accent preview for a color picker drag. It writes the accent straight to <html>, skipping
 * React, and marks <html> so CSS turns transitions off; otherwise every step would restart color
 * transitions across the page. Call `endAccentPreview` when the drag ends.
 */
export function previewAccent(root: HTMLElement, accent: string): void {
  root.dataset.accentPreview = "";
  setAccentVariables(root, accent);
}

/** Ends a live accent preview, optionally restoring an accent when the preview is discarded. */
export function endAccentPreview(root: HTMLElement, restore?: { accent: string | null }): void {
  if (restore) setAccentVariables(root, restore.accent);
  delete root.dataset.accentPreview;
}

export function applyAppearance(root: HTMLElement, appearance: AppearancePreferences): void {
  for (const [name, value] of Object.entries(getAppearanceVariables(appearance))) {
    if (value) root.style.setProperty(name, value);
    else root.style.removeProperty(name);
  }

  root.dataset.themeMode = appearance.theme;
  applyResolvedTheme(root, resolveTheme(appearance.theme));
}

/** Keeps `theme: "system"` in step with the OS setting. Returns a cleanup function. */
export function watchSystemTheme(root: HTMLElement): () => void {
  const query = window.matchMedia("(prefers-color-scheme: light)");
  const onChange = () => {
    if (root.dataset.themeMode !== "system") return;
    applyResolvedTheme(root, query.matches ? "light" : "dark");
  };

  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function cacheAppearance(userId: string, appearance: AppearancePreferences): void {
  try {
    window.localStorage.setItem(
      APPEARANCE_STORAGE_KEY,
      JSON.stringify({ userId, theme: appearance.theme, variables: getAppearanceVariables(appearance) }),
    );
  } catch {
    // The theme still applies once preferences load when storage is unavailable or full.
  }
}

/**
 * Applies the cached theme before first paint so light-theme users don't see a dark flash.
 * Without a cache entry the server-rendered dark theme stays.
 */
export function getAppearancePrePaintScript(userId: string | undefined): string {
  if (!userId) return "";

  const serializedStorageKey = JSON.stringify(APPEARANCE_STORAGE_KEY);
  const serializedUserId = JSON.stringify(userId).replaceAll("<", "\\u003c");

  return `(() => {
  try {
    const cached = JSON.parse(localStorage.getItem(${serializedStorageKey}) || "null");
    if (!cached || cached.userId !== ${serializedUserId}) return;

    const root = document.documentElement;
    const mode = cached.theme === "light" || cached.theme === "system" ? cached.theme : "dark";
    const resolved = mode === "system"
      ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")
      : mode;

    const variables = cached.variables && typeof cached.variables === "object" ? cached.variables : {};
    for (const name of ["--custom-primary", "--custom-primary-foreground", "--surface-tint"]) {
      const value = variables[name];
      if (typeof value === "string" && value && !/[;{}<]/.test(value)) root.style.setProperty(name, value);
    }

    root.dataset.themeMode = mode;
    root.dataset.theme = resolved;
    root.classList.toggle("dark", resolved === "dark");
    root.style.colorScheme = resolved;
  } catch {}
})()`;
}

const themeListeners = new Set<() => void>();
let themeObserver: MutationObserver | null = null;

// One observer shared by every subscriber; many messages read the theme at once.
function subscribeToThemeAttribute(onChange: () => void) {
  themeListeners.add(onChange);
  if (!themeObserver) {
    themeObserver = new MutationObserver(() => {
      for (const listener of themeListeners) listener();
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  }

  return () => {
    themeListeners.delete(onChange);
    if (themeListeners.size === 0) {
      themeObserver?.disconnect();
      themeObserver = null;
    }
  };
}

/** The theme currently painted on <html>, for libraries that take a theme name. */
export function useResolvedTheme(): ResolvedTheme {
  return useSyncExternalStore(
    subscribeToThemeAttribute,
    () => (document.documentElement.dataset.theme === "light" ? "light" : "dark"),
    () => "dark",
  );
}

let appearancePreview: AppearancePreferences | null = null;
const previewListeners = new Set<() => void>();

/**
 * Settings shows unsaved appearance edits through this preview. While it is set, it wins over
 * the saved preferences, so an autosave that lands after a newer edit can't repaint the old theme.
 */
export function setAppearancePreview(appearance: AppearancePreferences | null): void {
  appearancePreview = appearance;
  for (const listener of previewListeners) listener();
}

function subscribeToAppearancePreview(onChange: () => void) {
  previewListeners.add(onChange);
  return () => previewListeners.delete(onChange);
}

export function useAppearancePreview(): AppearancePreferences | null {
  return useSyncExternalStore(
    subscribeToAppearancePreview,
    () => appearancePreview,
    () => null,
  );
}
