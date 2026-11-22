import { afterEach, describe, expect, setDefaultTimeout, test } from "bun:test";

setDefaultTimeout(20_000);

// actions.ts imports the asset URL helpers, which validate client env vars at import time.
for (const name of [
  "VITE_CONVEX_URL",
  "VITE_AXIOM_TOKEN",
  "VITE_AXIOM_DATASET",
  "VITE_API_ENDPOINT",
  "VITE_PUBLIC_ASSET_BASE_URL",
  "VITE_RAW_FILE_BASE_URL",
]) {
  process.env[name] ??= "https://example.test";
}

// The DOM must exist before Testing Library loads: it binds `screen` to the document when first evaluated.
await import("@/test/dom");
// happy-dom's Element.animate rejects when Motion cancels a slide mid-navigation; Motion's JS animator doesn't.
Reflect.deleteProperty(Element.prototype, "animate");
const { render, screen, waitFor, within } = await import("@testing-library/react");
const { default: userEvent } = await import("@testing-library/user-event");
const { computeAccessibleName } = await import("dom-accessibility-api");
const { createAgent } = await import("@ui-sdk/react/agent");
const { ImageLightboxProvider, ImageLightboxTrigger } = await import("./provider");

const agent = createAgent();

// Unmounting queues a React scheduler task; let it run before the shared setup removes the DOM.
afterEach(() => new Promise((resolve) => setTimeout(resolve, 20)));

const images = [
  { id: "a", src: "https://example.test/a.png", name: "alpha.png" },
  { id: "b", src: "https://example.test/b.png", name: "beta.png" },
  { id: "c", src: "https://example.test/c.png", name: "gamma.png" },
];

const TOOLBAR_LABELS = [
  "Zoom in",
  "Zoom out",
  "Reset zoom",
  "Download image",
  "Copy URL",
  "Open in new tab",
  "Copy image",
  "Close",
];

async function openViewer(index = 0) {
  const user = userEvent.setup();
  render(
    <ImageLightboxProvider images={images}>
      <ImageLightboxTrigger index={index} aria-label="Open viewer">
        thumbnail
      </ImageLightboxTrigger>
    </ImageLightboxProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Open viewer" }));
  const dialog = await screen.findByRole("dialog");
  return { user, dialog };
}

function focusedName() {
  const focused = document.activeElement;
  return focused instanceof HTMLElement ? computeAccessibleName(focused) : null;
}

function position(dialog: HTMLElement) {
  return within(dialog).getByRole("heading", { level: 2 }).textContent;
}

function tabbable(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLElement>("button, [role=option]")].filter(
    (element) => element.tabIndex >= 0,
  );
}

function mainImage(dialog: HTMLElement) {
  return within(dialog).getByRole("img", { name: /\.png$/ });
}

describe("image viewer toolbar", () => {
  test("is one named tab stop with every action named", async () => {
    const { dialog } = await openViewer();
    const toolbar = within(dialog).getByRole("toolbar", { name: "Image actions" });

    const buttons = within(toolbar).getAllByRole("button");
    expect(buttons.map((button) => computeAccessibleName(button))).toEqual(TOOLBAR_LABELS);
    expect(tabbable(toolbar)).toHaveLength(1);
    for (const button of buttons) expect(button.hasAttribute("aria-disabled")).toBe(false);
  });

  test("arrow keys move between actions without changing the image", async () => {
    const { user, dialog } = await openViewer();
    const toolbar = within(dialog).getByRole("toolbar", { name: "Image actions" });
    within(toolbar).getByRole("button", { name: "Zoom in" }).focus();

    await user.keyboard("{ArrowRight}");
    expect(focusedName()).toBe("Zoom out");
    await user.keyboard("{End}");
    expect(focusedName()).toBe("Close");
    await user.keyboard("{ArrowLeft}");
    expect(focusedName()).toBe("Copy image");
    expect(position(dialog)).toBe("alpha.png");
  });

  test("Close closes the viewer and returns focus to the trigger", async () => {
    const { user, dialog } = await openViewer();
    await user.click(within(dialog).getByRole("button", { name: "Close" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(focusedName()).toBe("Open viewer");
  });
});

describe("image viewer thumbnails", () => {
  test("are one named tab stop with the current image selected", async () => {
    const { dialog } = await openViewer(1);
    const list = within(dialog).getByRole("listbox", { name: "Image thumbnails" });
    const options = within(list).getAllByRole("option");

    expect(options.map((option) => computeAccessibleName(option))).toEqual([
      "alpha.png",
      "beta.png",
      "gamma.png",
    ]);
    expect(options.map((option) => option.getAttribute("aria-selected"))).toEqual(["false", "true", "false"]);
    expect(tabbable(list)).toEqual([options[1]!]);
    for (const option of options) {
      expect(option.hasAttribute("aria-pressed")).toBe(false);
      expect(option.hasAttribute("aria-current")).toBe(false);
    }
  });

  test("arrow keys, Home and End switch the image", async () => {
    const { user, dialog } = await openViewer();
    within(dialog).getByRole("option", { name: "alpha.png" }).focus();

    await user.keyboard("{ArrowRight}");
    await waitFor(() => expect(position(dialog)).toBe("beta.png"));
    expect(focusedName()).toBe("beta.png");
    await user.keyboard("{End}");
    await waitFor(() => expect(position(dialog)).toBe("gamma.png"));
    await user.keyboard("{Home}");
    await waitFor(() => expect(position(dialog)).toBe("alpha.png"));
    await user.keyboard("{ArrowLeft}");
    await waitFor(() => expect(position(dialog)).toBe("gamma.png"));
  });

  test("pressing a thumbnail shows it", async () => {
    const { user, dialog } = await openViewer();
    await user.click(within(dialog).getByRole("option", { name: "gamma.png" }));

    await waitFor(() => expect(position(dialog)).toBe("gamma.png"));
    expect(within(dialog).getByRole("option", { name: "gamma.png" }).getAttribute("aria-selected")).toBe(
      "true",
    );
  });

  test("Escape in the list still closes the viewer", async () => {
    const { user, dialog } = await openViewer();
    within(dialog).getByRole("option", { name: "alpha.png" }).focus();
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

describe("image viewer keys", () => {
  test("arrow keys outside the toolbar and list still switch images", async () => {
    const { user, dialog } = await openViewer();
    within(dialog).getByRole("button", { name: "Next image" }).focus();

    await user.keyboard("{ArrowRight}");
    await waitFor(() => expect(position(dialog)).toBe("beta.png"));
    await user.keyboard("{ArrowLeft}");
    await waitFor(() => expect(position(dialog)).toBe("alpha.png"));
  });

  test("plus, minus and 0 zoom the image", async () => {
    const { user, dialog } = await openViewer();
    within(dialog).getByRole("button", { name: "Next image" }).focus();

    await user.keyboard("+");
    await waitFor(() => expect(mainImage(dialog).style.transform).toContain("scale(1.5)"));
    await user.keyboard("+");
    await waitFor(() => expect(mainImage(dialog).style.transform).toContain("scale(2.25)"));
    await user.keyboard("-");
    await waitFor(() => expect(mainImage(dialog).style.transform).toContain("scale(1.5)"));
    await user.keyboard("0");
    await waitFor(() => expect(mainImage(dialog).style.transform).toContain("scale(1)"));
    expect(position(dialog)).toBe("alpha.png");
  });

  test("zoom keys work from the toolbar but leave the thumbnail list to typeahead", async () => {
    const { user, dialog } = await openViewer();
    within(dialog).getByRole("button", { name: "Zoom in" }).focus();
    await user.keyboard("+");
    await waitFor(() => expect(mainImage(dialog).style.transform).toContain("scale(1.5)"));

    within(dialog).getByRole("option", { name: "alpha.png" }).focus();
    await user.keyboard("0");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mainImage(dialog).style.transform).toContain("scale(1.5)");
  });

  test("Ctrl with plus is left to the browser", async () => {
    const { user, dialog } = await openViewer();
    within(dialog).getByRole("button", { name: "Next image" }).focus();
    await user.keyboard("{Control>}+{/Control}");
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(mainImage(dialog).style.transform).toBe("");
  });
});

describe("image viewer agent", () => {
  test("an agent can find the actions and switch images", async () => {
    const { dialog } = await openViewer();

    const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more");
    for (const entry of components) {
      expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy();
    }
    const labels = components.map((entry) => entry.label);
    for (const label of ["Image actions", "Image thumbnails"]) {
      expect(labels, `${label} is missing from the snapshot`).toContain(label);
    }

    const result = await agent.act({
      steps: [{ ref: "Image thumbnails", action: "setValue", args: ["2"] }],
    });
    expect(result.ok, result.error?.message).toBe(true);
    await waitFor(() => expect(position(dialog)).toBe("gamma.png"));
  });
});
