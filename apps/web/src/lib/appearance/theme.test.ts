import { describe, expect, test } from "bun:test";

await import("@/test/dom");
const {
  DEFAULT_APPEARANCE,
  applyAppearance,
  getAccentForeground,
  getAppearancePrePaintScript,
  getAppearanceVariables,
  normalizeAppearance,
} = await import("./theme");

describe("normalizeAppearance", () => {
  test("fills defaults and drops invalid values", () => {
    expect(normalizeAppearance(undefined)).toEqual(DEFAULT_APPEARANCE);
    expect(
      normalizeAppearance({ accent: "red", tint: 500, backdropBlur: Number.NaN, blurMode: "backdrop" }),
    ).toEqual({ ...DEFAULT_APPEARANCE, accent: null, tint: 100, blurMode: "backdrop" });
    expect(normalizeAppearance({ accent: "#ABCDEF" }).accent).toBe("#abcdef");
  });
});

describe("getAccentForeground", () => {
  test("uses dark text on light accents and white text on dark accents", () => {
    expect(getAccentForeground("#f4a38c")).toBe("#0a0a0a");
    expect(getAccentForeground("#1e3a8a")).toBe("#ffffff");
  });
});

describe("applyAppearance", () => {
  test("sets the theme attributes and accent variables, and clears them again", () => {
    const root = document.documentElement;

    applyAppearance(root, { ...DEFAULT_APPEARANCE, theme: "light", accent: "#10b981", tint: 50 });
    expect(root.dataset.theme).toBe("light");
    expect(root.classList.contains("dark")).toBe(false);
    expect(root.style.getPropertyValue("--custom-primary")).toBe("#10b981");
    expect(root.style.getPropertyValue("--surface-tint")).toBe("8.00%");

    applyAppearance(root, DEFAULT_APPEARANCE);
    expect(root.dataset.theme).toBe("dark");
    expect(root.classList.contains("dark")).toBe(true);
    expect(root.style.getPropertyValue("--custom-primary")).toBe("");
  });
});

describe("getAppearancePrePaintScript", () => {
  test("applies only the cached entry for the same user", () => {
    const root = document.documentElement;
    root.className = "dark";
    root.dataset.theme = "dark";

    const appearance = { ...DEFAULT_APPEARANCE, theme: "light" as const, accent: "#3b82f6" };
    localStorage.setItem(
      "ai-chat:appearance",
      JSON.stringify({ userId: "user_1", theme: "light", variables: getAppearanceVariables(appearance) }),
    );

    // oxlint-disable-next-line typescript/no-implied-eval -- runs the inline script exactly as the page would.
    new Function(getAppearancePrePaintScript("user_2"))();
    expect(root.dataset.theme).toBe("dark");

    // oxlint-disable-next-line typescript/no-implied-eval
    new Function(getAppearancePrePaintScript("user_1"))();
    expect(root.dataset.theme).toBe("light");
    expect(root.classList.contains("dark")).toBe(false);
    expect(root.style.getPropertyValue("--custom-primary")).toBe("#3b82f6");

    expect(getAppearancePrePaintScript(undefined)).toBe("");
  });
});
