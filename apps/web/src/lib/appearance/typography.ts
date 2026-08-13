import type { CSSProperties } from "react";

export const DEFAULT_UI_FONT = "Space Grotesk";
export const DEFAULT_UI_FONT_SIZE = 16;
export const DEFAULT_PROMPT_FONT_SIZE = 15;
export const DEFAULT_CODE_FONT = "JetBrains Mono";
export const DEFAULT_CODE_FONT_SIZE = 14;
export const TYPOGRAPHY_STORAGE_KEY = "ai-chat:typography";

export type TypographyPreferences = {
  ui: string;
  code: string;
  prompt?: string;
  uiSize?: number;
  promptSize?: number;
  codeSize?: number;
};

export type TypographyStyle = CSSProperties & {
  "--custom-ui-font": string;
  "--custom-ui-font-size": string;
  "--custom-prompt-font": string;
  "--custom-prompt-font-size": string;
  "--custom-code-font": string;
  "--custom-code-font-size": string;
};

export function getTypographyStyle(fonts: TypographyPreferences): TypographyStyle {
  return {
    "--custom-ui-font": fonts.ui || DEFAULT_UI_FONT,
    "--custom-ui-font-size": `${fonts.uiSize ?? DEFAULT_UI_FONT_SIZE}px`,
    "--custom-prompt-font": fonts.prompt || DEFAULT_UI_FONT,
    "--custom-prompt-font-size": `${fonts.promptSize ?? DEFAULT_PROMPT_FONT_SIZE}px`,
    "--custom-code-font": fonts.code || DEFAULT_CODE_FONT,
    "--custom-code-font-size": `${fonts.codeSize ?? DEFAULT_CODE_FONT_SIZE}px`,
  };
}

export function applyTypography(element: HTMLElement, fonts: TypographyPreferences): void {
  const style = getTypographyStyle(fonts);
  element.style.setProperty("--custom-ui-font", style["--custom-ui-font"]);
  element.style.setProperty("--custom-ui-font-size", style["--custom-ui-font-size"]);
  element.style.setProperty("--custom-prompt-font", style["--custom-prompt-font"]);
  element.style.setProperty("--custom-prompt-font-size", style["--custom-prompt-font-size"]);
  element.style.setProperty("--custom-code-font", style["--custom-code-font"]);
  element.style.setProperty("--custom-code-font-size", style["--custom-code-font-size"]);
}

export function cacheTypography(userId: string, fonts: TypographyPreferences): void {
  try {
    window.localStorage.setItem(TYPOGRAPHY_STORAGE_KEY, JSON.stringify({ userId, fonts }));
  } catch {
    // Typography still works when storage is unavailable or full.
  }
}

export function getTypographyPrePaintScript(userId: string | undefined): string {
  if (!userId) return "";

  const serializedStorageKey = JSON.stringify(TYPOGRAPHY_STORAGE_KEY);
  const serializedUserId = JSON.stringify(userId).replaceAll("<", "\\u003c");

  return `(() => {
  try {
    const cached = JSON.parse(localStorage.getItem(${serializedStorageKey}) || "null");
    if (!cached || cached.userId !== ${serializedUserId} || !cached.fonts) return;

    const fonts = cached.fonts;
    const root = document.documentElement;
    const font = (value, fallback) => typeof value === "string" && value.trim() ? value : fallback;
    const size = (value, fallback) => Number.isFinite(value) && value >= 8 && value <= 72 ? value : fallback;

    root.style.setProperty("--custom-ui-font", font(fonts.ui, ${JSON.stringify(DEFAULT_UI_FONT)}));
    root.style.setProperty("--custom-ui-font-size", size(fonts.uiSize, ${DEFAULT_UI_FONT_SIZE}) + "px");
    root.style.setProperty("--custom-prompt-font", font(fonts.prompt, ${JSON.stringify(DEFAULT_UI_FONT)}));
    root.style.setProperty("--custom-prompt-font-size", size(fonts.promptSize, ${DEFAULT_PROMPT_FONT_SIZE}) + "px");
    root.style.setProperty("--custom-code-font", font(fonts.code, ${JSON.stringify(DEFAULT_CODE_FONT)}));
    root.style.setProperty("--custom-code-font-size", size(fonts.codeSize, ${DEFAULT_CODE_FONT_SIZE}) + "px");
  } catch {}
})()`;
}
