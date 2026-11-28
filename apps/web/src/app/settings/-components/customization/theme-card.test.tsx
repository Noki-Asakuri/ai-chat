import { afterEach, describe, expect, mock, test } from "bun:test";

// The DOM must exist before Testing Library loads: it binds `screen` to the document when first evaluated.
await import("@/test/dom");
const { act, fireEvent, render, screen } = await import("@testing-library/react");

async function interact(run: () => void) {
  await act(async () => {
    run();
    // Let the frame-limited preview paint.
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const { ThemeCard } = await import("./theme-card");

const root = document.documentElement;
afterEach(() => {
  root.style.removeProperty("--custom-primary");
  root.style.removeProperty("--custom-primary-foreground");
  delete root.dataset.accentPreview;
});

async function openPicker(accent: string | null = null) {
  const onAccentChange = mock((_accent: string | null) => {});
  const view = render(
    <ThemeCard
      disabled={false}
      theme="dark"
      accent={accent}
      tint={0}
      onThemeChange={() => {}}
      onAccentChange={onAccentChange}
      onTintChange={() => {}}
    />,
  );
  await interact(() => fireEvent.click(screen.getByRole("button", { name: "Custom accent color" })));
  const hex = await screen.findByRole<HTMLInputElement>("textbox", { name: "Hex color" });
  return { onAccentChange, hex, view };
}

function stubArea() {
  const area = document.querySelector<HTMLElement>('[data-slot="color-picker-area"]')!;
  area.getBoundingClientRect = () => new DOMRect(0, 0, 100, 100);
  return area;
}

describe("ThemeCard custom accent", () => {
  test("the picker opens on the current accent", async () => {
    const { hex } = await openPicker("#10b981");
    expect(hex.value).toBe("#10b981");
  });

  test("the picker starts from the default custom color when the accent is built in", async () => {
    const { hex } = await openPicker();
    expect(hex.value).toBe("#8b7cf6");
  });

  test("a typed hex color is saved once", async () => {
    const { onAccentChange, hex } = await openPicker();

    await interact(() => fireEvent.change(hex, { target: { value: "#FF0000" } }));
    await interact(() => fireEvent.keyDown(hex, { key: "Enter" }));

    expect(onAccentChange.mock.calls).toEqual([["#ff0000"]]);
    expect(root.style.getPropertyValue("--custom-primary")).toBe("#ff0000");
    expect(root.dataset.accentPreview).toBeUndefined();
  });

  test("a hue key step saves the new color", async () => {
    const { onAccentChange } = await openPicker("#ff0000");
    const hue = screen
      .getAllByRole("slider")
      .find((thumb) => thumb.closest('[data-slot="color-picker-slider"]'))!;

    await interact(() => fireEvent.keyDown(hue, { key: "ArrowRight" }));

    expect(onAccentChange).toHaveBeenCalledTimes(1);
    const saved = onAccentChange.mock.calls[0]![0]!;
    expect(saved).toMatch(/^#[0-9a-f]{6}$/);
    expect(saved).not.toBe("#ff0000");
  });

  test("dragging previews live with transitions off and saves once on release", async () => {
    const { onAccentChange } = await openPicker("#ff0000");
    const area = stubArea();

    await interact(() => {
      fireEvent.pointerDown(area, { pointerId: 1, button: 0, clientX: 10, clientY: 10 });
      for (let step = 0; step < 20; step++) {
        fireEvent.pointerMove(area, { pointerId: 1, clientX: 10 + step * 4, clientY: 10 + step });
      }
    });

    const previewed = root.style.getPropertyValue("--custom-primary");
    expect(previewed).toMatch(/^#[0-9a-f]{6}$/);
    expect(root.dataset.accentPreview).toBe("");
    expect(onAccentChange).not.toHaveBeenCalled();

    await interact(() => fireEvent.pointerUp(area, { pointerId: 1, clientX: 86, clientY: 29 }));
    expect(onAccentChange).toHaveBeenCalledTimes(1);
    expect(root.style.getPropertyValue("--custom-primary")).toBe(onAccentChange.mock.calls[0]![0]!);
    expect(root.dataset.accentPreview).toBeUndefined();
  });

  test("leaving the page mid-drag still saves the last color", async () => {
    const { onAccentChange, view } = await openPicker("#ff0000");
    const area = stubArea();

    await interact(() => {
      fireEvent.pointerDown(area, { pointerId: 1, button: 0, clientX: 10, clientY: 10 });
      fireEvent.pointerMove(area, { pointerId: 1, clientX: 60, clientY: 40 });
    });
    const previewed = root.style.getPropertyValue("--custom-primary");
    view.unmount();

    expect(onAccentChange.mock.calls).toEqual([[previewed]]);
    expect(root.dataset.accentPreview).toBeUndefined();
  });

  test("presets save their color", async () => {
    const { onAccentChange } = await openPicker();
    await interact(() => fireEvent.click(screen.getByRole("radio", { name: "Emerald" })));
    expect(onAccentChange.mock.calls).toEqual([["#10b981"]]);
  });
});
