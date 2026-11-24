import { afterEach, describe, expect, mock, test } from "bun:test";

// The DOM must exist before Testing Library loads: it binds `screen` to the document when first evaluated.
await import("@/test/dom");
const { act, fireEvent, render, screen } = await import("@testing-library/react");

// Run interactions in an async act so any follow-up updates from Base UI settle inside it.
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

function renderCard() {
  const onAccentChange = mock((_accent: string | null) => {});
  const view = render(
    <ThemeCard
      disabled={false}
      theme="dark"
      accent={null}
      tint={0}
      onThemeChange={() => {}}
      onAccentChange={onAccentChange}
      onTintChange={() => {}}
    />,
  );
  const picker = view.container.querySelector<HTMLInputElement>('input[type="color"]')!;
  return { onAccentChange, picker, view };
}

describe("ThemeCard custom accent", () => {
  test("dragging previews live with transitions off and commits once when the picker closes", async () => {
    const { onAccentChange, picker } = renderCard();
    const swatch = picker.closest("label")!;

    await interact(() => {
      for (let step = 0; step < 30; step++) {
        const channel = (16 + step).toString(16).padStart(2, "0");
        fireEvent.input(picker, { target: { value: `#${channel}0000` } });
      }
    });

    // The app previews the latest color without going through React or the form.
    expect(root.style.getPropertyValue("--custom-primary")).toBe("#2d0000");
    expect(root.style.getPropertyValue("--custom-primary-foreground")).toBe("#ffffff");
    expect(root.dataset.accentPreview).toBe("");
    expect(swatch.style.background).toBe("#2d0000");
    expect(screen.getByText("#2d0000")).toBeTruthy();
    expect(onAccentChange).not.toHaveBeenCalled();

    await interact(() => fireEvent.change(picker));
    expect(onAccentChange.mock.calls).toEqual([["#2d0000"]]);
    expect(root.dataset.accentPreview).toBeUndefined();
  });

  test("choosing a preset drops an uncommitted custom color", async () => {
    const { onAccentChange, picker } = renderCard();

    await interact(() => fireEvent.input(picker, { target: { value: "#ff0000" } }));
    await interact(() => {
      fireEvent.click(screen.getByRole("radio", { name: "Emerald" }));
      fireEvent.blur(picker);
    });

    expect(onAccentChange.mock.calls).toEqual([["#10b981"]]);
    // The previewed color is dropped from the swatch and <html>.
    expect(screen.queryByText("#ff0000")).toBeNull();
    expect(root.style.getPropertyValue("--custom-primary")).toBe("#10b981");
    expect(root.dataset.accentPreview).toBeUndefined();
  });

  test("leaving the page mid-drag still saves the last color", async () => {
    const { onAccentChange, picker, view } = renderCard();

    await interact(() => {
      fireEvent.input(picker, { target: { value: "#ff0000" } });
      fireEvent.input(picker, { target: { value: "#0000ff" } });
    });
    view.unmount();

    expect(onAccentChange.mock.calls).toEqual([["#0000ff"]]);
    expect(root.dataset.accentPreview).toBeUndefined();
  });
});
