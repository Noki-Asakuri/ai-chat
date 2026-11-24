import { describe, expect, mock, test } from "bun:test";

// The DOM must exist before Testing Library loads: it binds `screen` to the document when first evaluated.
await import("@/test/dom");
const { act, fireEvent, render, screen } = await import("@testing-library/react");

// Base UI's slider re-measures when the section's preview style changes; run interactions in an
// async act so that follow-up update settles inside it.
async function interact(run: () => void) {
  await act(async () => {
    run();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const { ThemeCard } = await import("./theme-card");

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
  test("dragging previews in the section only and commits once when the picker closes", async () => {
    const { onAccentChange, picker, view } = renderCard();

    await interact(() => {
      for (let step = 0; step < 30; step++) {
        const channel = (16 + step).toString(16).padStart(2, "0");
        fireEvent.input(picker, { target: { value: `#${channel}0000` } });
      }
    });

    // The swatch, label and section accent follow the drag; the app isn't re-themed yet.
    expect(screen.getByText("#2d0000")).toBeTruthy();
    expect(view.container.firstElementChild?.getAttribute("style")).toContain("--primary: #2d0000");
    expect(onAccentChange).not.toHaveBeenCalled();

    await interact(() => fireEvent.change(picker));
    expect(onAccentChange.mock.calls).toEqual([["#2d0000"]]);
    expect(view.container.firstElementChild?.getAttribute("style")).toBeNull();
  });

  test("choosing a preset drops an uncommitted custom color", async () => {
    const { onAccentChange, picker } = renderCard();

    await interact(() => fireEvent.input(picker, { target: { value: "#ff0000" } }));
    await interact(() => {
      fireEvent.click(screen.getByRole("radio", { name: "Emerald" }));
      fireEvent.blur(picker);
    });

    expect(onAccentChange.mock.calls).toEqual([["#10b981"]]);
  });

  test("leaving the page mid-drag still saves the last color", async () => {
    const { onAccentChange, picker, view } = renderCard();

    await interact(() => {
      fireEvent.input(picker, { target: { value: "#ff0000" } });
      fireEvent.input(picker, { target: { value: "#0000ff" } });
    });
    view.unmount();

    expect(onAccentChange.mock.calls).toEqual([["#0000ff"]]);
  });
});
