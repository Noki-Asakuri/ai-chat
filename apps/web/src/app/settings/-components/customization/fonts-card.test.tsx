import { describe, expect, mock, setDefaultTimeout, spyOn, test } from "bun:test";

// Each test renders the whole typography card in happy-dom; on a busy CI worker that can pass 5s.
setDefaultTimeout(20_000);

// The DOM must exist before Testing Library loads: it binds `screen` to the document when first evaluated.
await import("@/test/dom");
const { act, render, screen, waitFor } = await import("@testing-library/react");
const { default: userEvent } = await import("@testing-library/user-event");
const { computeAccessibleName } = await import("dom-accessibility-api");

const { FontsCard } = await import("./fonts-card");

function focusedName() {
  const focused = document.activeElement;
  return focused instanceof HTMLElement ? computeAccessibleName(focused) : null;
}

function renderCard() {
  const onUiFontChange = mock((_font: string) => {});
  render(
    <FontsCard
      disabled={false}
      uiFont="Space Grotesk"
      uiFontSize={14}
      promptFont="Space Grotesk"
      promptFontSize={14}
      codeFont="JetBrains Mono"
      codeFontSize={14}
      onUiFontChange={onUiFontChange}
      onUiFontSizeChange={() => {}}
      onPromptFontChange={() => {}}
      onPromptFontSizeChange={() => {}}
      onCodeFontChange={() => {}}
      onCodeFontSizeChange={() => {}}
    />,
  );
  return { onUiFontChange };
}

describe("FontCombobox", () => {
  test("searching and pressing Enter applies the font and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    const { onUiFontChange } = renderCard();

    await user.click(screen.getByRole("button", { name: "Interface font: Space Grotesk" }));
    await waitFor(() => expect(focusedName()).toBe("Search interface fonts"));
    await user.keyboard("jet");
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["JetBrains Mono"]);
    await user.keyboard("{Enter}");

    await waitFor(() => expect(onUiFontChange).toHaveBeenCalledWith("JetBrains Mono"));
    expect(focusedName()).toBe("Interface font: Space Grotesk");
  });

  test("opening keeps focus that already moved into the popup", async () => {
    const user = userEvent.setup();
    renderCard();

    // Hold the opening animation so focus can enter the popup first, as a touch screen reader does.
    const animation = new Animation();
    const getAnimations = spyOn(Element.prototype, "getAnimations").mockReturnValue([animation]);

    try {
      await user.click(screen.getByRole("button", { name: "Interface font: Space Grotesk" }));
      const option = screen.getByRole("option", { name: "Space Grotesk" });
      act(() => option.focus());
      await act(async () => animation.finish());

      expect(focusedName()).toBe("Space Grotesk");
    } finally {
      getAnimations.mockRestore();
    }
  });

  test("shows an empty message when nothing matches", async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByRole("button", { name: "Interface font: Space Grotesk" }));
    await waitFor(() => expect(focusedName()).toBe("Search interface fonts"));
    await user.paste("no such font");

    expect(screen.getByText("No fonts found.")).toBeTruthy();
  });
});
