import { describe, expect, mock, test } from "bun:test";

// The DOM must exist before Testing Library loads: it binds `screen` to the document when first evaluated.
await import("@/test/dom");
const { act, fireEvent, render, screen } = await import("@testing-library/react");

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

async function wait(ms: number) {
  await act(() => new Promise((resolve) => setTimeout(resolve, ms)));
}

describe("ThemeCard custom accent", () => {
  test("dragging the picker commits a few times, ending on the last color", async () => {
    const { onAccentChange, picker } = renderCard();

    const startedAt = performance.now();
    for (let step = 0; step < 30; step++) {
      const channel = (16 + step).toString(16).padStart(2, "0");
      fireEvent.change(picker, { target: { value: `#${channel}0000` } });
    }
    const dragMs = performance.now() - startedAt;

    // The swatch follows the drag right away.
    expect(screen.getByText("#2d0000")).toBeTruthy();

    await wait(200);
    // At most one commit per 120ms window (plus leading and trailing), not one per movement.
    expect(onAccentChange.mock.calls.length).toBeLessThanOrEqual(Math.ceil(dragMs / 120) + 2);
    expect(onAccentChange.mock.calls.length).toBeLessThan(30);
    expect(onAccentChange.mock.calls.at(-1)?.[0]).toBe("#2d0000");
  });

  test("choosing a preset drops a pending custom color", async () => {
    const { onAccentChange, picker } = renderCard();

    fireEvent.change(picker, { target: { value: "#ff0000" } });
    fireEvent.change(picker, { target: { value: "#00ff00" } });
    fireEvent.click(screen.getByRole("radio", { name: "Emerald" }));

    await wait(200);
    expect(onAccentChange.mock.calls.at(-1)?.[0]).toBe("#10b981");
  });

  test("leaving the page mid-drag still saves the last color", () => {
    const { onAccentChange, picker, view } = renderCard();

    fireEvent.change(picker, { target: { value: "#ff0000" } });
    fireEvent.change(picker, { target: { value: "#0000ff" } });
    view.unmount();

    expect(onAccentChange.mock.calls.at(-1)?.[0]).toBe("#0000ff");
  });
});
