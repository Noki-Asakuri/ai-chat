import { afterAll, describe, expect, mock, setDefaultTimeout, spyOn, test } from "bun:test";

// Each test renders the full picker in happy-dom; on a busy CI worker the first render alone can pass 5s.
setDefaultTimeout(20_000);

// The DOM must exist before Testing Library loads: it binds `screen` to the document when first evaluated.
await import("@/test/dom");
const { act, render, screen, waitFor, within } = await import("@testing-library/react");
const { default: userEvent } = await import("@testing-library/user-event");

const savedFavorites: string[][] = [];
const actualConvexReact = await import("convex/react");
await mock.module("convex/react", () => ({
  ...actualConvexReact,
  useMutation: () => async (args: { data: { favorite: string[] } }) => {
    savedFavorites.push(args.data.favorite);
  },
}));

const { computeAccessibleDescription, computeAccessibleName } = await import("dom-accessibility-api");
const { createAgent } = await import("@ui-sdk/react/agent");
const { ConfigStoreContext } = await import("@/components/provider/config-provider");
const { createConfigStore } = await import("@/lib/store/config-store");
const { SelectableModelIds, tryGetModelData } = await import("@/lib/chat/models");
const { ModelSelector } = await import("./model-selector");

const agent = createAgent();

afterAll(() => mock.restore());

const [firstId, secondId] = SelectableModelIds;
if (!firstId || !secondId) throw new Error("Expected at least two selectable models");
const labelOf = (id: string) => {
  const data = tryGetModelData(id);
  if (!data) throw new Error(`Unknown model ${id}`);
  return data.display.unique ?? data.display.name;
};

function renderSelector(options: { favorites?: string[] } = {}) {
  const store = createConfigStore({ favoriteModels: options.favorites ?? [] });
  const onChange = mock((_id: string) => {});
  const view = render(
    <ConfigStoreContext.Provider value={store}>
      <ModelSelector value={firstId!} onChange={onChange} />
    </ConfigStoreContext.Provider>,
  );
  return { ...view, store, onChange };
}

// Compare names, not elements: a failing toBe on DOM nodes makes Bun serialize the whole happy-dom graph and hang.
function focusedName() {
  const focused = document.activeElement;
  return focused instanceof HTMLElement ? computeAccessibleName(focused) : null;
}

function describedText(element: HTMLElement) {
  return computeAccessibleDescription(element);
}

async function openPicker(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Select model" }));
  const search = await screen.findByRole("combobox", { name: "Search models" });
  await waitFor(() => expect(focusedName()).toBe("Search models"));
  return search;
}

describe("ModelSelector", () => {
  test("shows the selected model on a named trigger", () => {
    renderSelector();
    expect(screen.getByRole("button", { name: "Select model" }).textContent).toContain(labelOf(firstId));
  });

  test("filters by search, chooses with Enter and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    const { onChange } = renderSelector();
    const search = await openPicker(user);

    search.focus();
    await user.paste(labelOf(secondId));
    const list = screen.getByRole("listbox", { name: "Models" });
    const option = within(list).getByRole("option", { name: labelOf(secondId) });
    if (tryGetModelData(secondId)?.capabilities.reasoning === undefined)
      throw new Error("Expected a reasoning model");
    expect(describedText(option)).toContain("This model supports reasoning.");
    expect(describedText(option)).toContain("Not a favorite.");
    await user.keyboard("{Enter}");

    expect(onChange).toHaveBeenLastCalledWith(secondId);
    await waitFor(() => expect(focusedName()).toBe("Select model"));
  });

  test("section rail filters the list and keeps the picker open", async () => {
    const user = userEvent.setup();
    renderSelector();
    await openPicker(user);

    const sections = screen.getByRole("radiogroup", { name: "Model sections" });
    await user.click(within(sections).getByRole("radio", { name: "Favorites" }));

    expect(screen.getByText("No favorite models yet. Star a model to pin it here.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Select model" }).getAttribute("aria-expanded")).toBe("true");
    await waitFor(() => expect(focusedName()).toBe("Search models"));
  });

  test("Tab moves into the section rail without closing the picker", async () => {
    const user = userEvent.setup();
    renderSelector();
    await openPicker(user);

    await user.tab();

    const sections = screen.getByRole("radiogroup", { name: "Model sections" });
    expect(sections.contains(document.activeElement)).toBe(true);
    const trigger = screen.getByRole("button", { name: "Select model" });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });

  test("tabbing out of the section rail closes the picker and moves on", async () => {
    const user = userEvent.setup();
    renderSelector();
    render(<input aria-label="Next field" />);
    await openPicker(user);

    await user.tab();
    await user.tab();
    await user.tab();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Select model" }).getAttribute("aria-expanded")).toBe(
        "false",
      ),
    );
    expect(focusedName()).toBe("Next field");
  });

  test("Escape closes the picker and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    renderSelector();
    await openPicker(user);

    await user.keyboard("{Escape}");

    const trigger = screen.getByRole("button", { name: "Select model" });
    await waitFor(() => expect(focusedName()).toBe("Select model"));
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  test("clicking a star favorites the model without choosing it", async () => {
    savedFavorites.length = 0;
    const user = userEvent.setup();
    const { onChange, store } = renderSelector();
    await openPicker(user);

    const option = screen.getByRole("option", { name: labelOf(secondId) });
    const star = option.querySelector<HTMLElement>("[title='Add to favorites']");
    if (!star) throw new Error("Missing favorite star");
    await user.click(star);

    expect(onChange).not.toHaveBeenCalled();
    await waitFor(() => expect(store.getState().favoriteModels).toEqual([secondId]));
    await waitFor(() =>
      expect(describedText(screen.getByRole("option", { name: labelOf(secondId) }))).toContain("Favorite."),
    );
    expect(savedFavorites.at(-1)).toEqual([secondId]);
  });

  test("Ctrl+Shift+F favorites the highlighted model", async () => {
    savedFavorites.length = 0;
    const user = userEvent.setup();
    const { store } = renderSelector();
    await openPicker(user);

    await user.keyboard("{Control>}{Shift>}F{/Shift}{/Control}");

    await waitFor(() => expect(store.getState().favoriteModels).toEqual([firstId]));
  });

  test("the footer favorite button toggles the highlighted model without choosing it", async () => {
    savedFavorites.length = 0;
    const user = userEvent.setup();
    const { onChange, store } = renderSelector();
    await openPicker(user);

    const favorite = screen.getByRole("button", { name: `Favorite ${labelOf(firstId)}` });
    expect(favorite.getAttribute("aria-pressed")).toBe("false");
    await user.click(favorite);

    await waitFor(() => expect(store.getState().favoriteModels).toEqual([firstId]));
    await waitFor(() => expect(favorite.getAttribute("aria-pressed")).toBe("true"));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Select model" }).getAttribute("aria-expanded")).toBe("true");
  });

  test("favorite actions are disabled when the search matches nothing", async () => {
    savedFavorites.length = 0;
    const user = userEvent.setup();
    const { store } = renderSelector();
    const search = await openPicker(user);

    search.focus();
    await user.paste("no model is called this");
    await user.keyboard("{Control>}{Shift>}F{/Shift}{/Control}");

    expect(screen.getByRole("button", { name: "Favorite model" }).hasAttribute("data-disabled")).toBe(true);
    expect(store.getState().favoriteModels).toEqual([]);
    expect(savedFavorites).toEqual([]);
  });

  test("closing from outside after focus moved elsewhere leaves focus there", async () => {
    const user = userEvent.setup();
    renderSelector();
    render(<textarea aria-label="Composer" />);
    await openPicker(user);

    // Hold the closing animation so focus moves before the close completes, as in a real browser.
    const animation = new Animation();
    const getAnimations = spyOn(Element.prototype, "getAnimations").mockReturnValue([animation]);

    try {
      const composer = screen.getByRole("textbox", { name: "Composer" });
      act(() => screen.getByRole("button", { name: "Select model" }).click());
      composer.focus();
      await act(async () => animation.finish());

      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Select model" }).getAttribute("aria-expanded")).toBe(
          "false",
        ),
      );
      expect(focusedName()).toBe("Composer");
    } finally {
      getAnimations.mockRestore();
    }
  });

  test("opening keeps focus that already moved into the popup", async () => {
    const user = userEvent.setup();
    renderSelector();

    // Hold the opening animation so focus can enter the popup first, as a touch screen reader does.
    const animation = new Animation();
    const getAnimations = spyOn(Element.prototype, "getAnimations").mockReturnValue([animation]);

    try {
      await user.click(screen.getByRole("button", { name: "Select model" }));
      const favorites = screen.getByRole("radio", { name: "Favorites" });
      act(() => favorites.focus());
      await act(async () => animation.finish());

      expect(focusedName()).toBe("Favorites");
    } finally {
      getAnimations.mockRestore();
    }
  });

  test("an agent can find the picker and choose a model", async () => {
    const { onChange } = renderSelector();

    const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more");
    for (const entry of components) {
      expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy();
    }
    expect(components.map((entry) => entry.label)).toContain("Select model");

    const found = await agent.query({ within: "Select model", text: labelOf(secondId) });
    if ("error" in found) throw new Error(found.error);
    const choice = found[0]?.items?.find((item) => item.label === labelOf(secondId));
    if (!choice) throw new Error(`The agent can't find ${labelOf(secondId)} in the closed picker`);

    const result = await act(() =>
      agent.act({ steps: [{ ref: "Select model", action: "setValue", args: [choice.value] }] }),
    );
    expect(result.ok, result.error?.message).toBe(true);
    expect(onChange).toHaveBeenLastCalledWith(secondId);
  });
});
