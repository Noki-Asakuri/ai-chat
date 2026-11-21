import { afterAll, beforeEach, describe, expect, mock, setDefaultTimeout, test } from "bun:test";

import type { NavigateCall } from "@/test/fixtures";

// Each test renders a full dialog in happy-dom; on a busy CI worker the first render alone can pass 5s.
setDefaultTimeout(20_000);

// The DOM must exist before Testing Library loads: it binds `screen` to the document when first evaluated.
await import("@/test/dom");
const { testGroupId } = await import("@/test/fixtures");
const { act, render, screen, waitFor } = await import("@testing-library/react");
const { default: userEvent } = await import("@testing-library/user-event");
const { computeAccessibleName } = await import("dom-accessibility-api");

const navigations: NavigateCall[] = [];
const actualRouter = await import("@tanstack/react-router");
await mock.module("@tanstack/react-router", () => ({
  ...actualRouter,
  useNavigate: () => async (options: NavigateCall) => {
    navigations.push(options);
  },
}));

const { threadStoreActions, useThreadStore } = await import("@/lib/store/thread-store");
const { NewChatButton } = await import("./new-chat-button");

const groups: Parameters<typeof NewChatButton>[0]["groups"] = [
  { _id: testGroupId("group-work"), _creationTime: 0, title: "Work", userId: "user" },
  { _id: testGroupId("group-home"), _creationTime: 0, title: "Personal", userId: "user" },
];

afterAll(() => mock.restore());

beforeEach(() => {
  navigations.length = 0;
  act(() => threadStoreActions.setActiveGroupId(testGroupId("group-home")));
});

function focusedName() {
  const focused = document.activeElement;
  return focused instanceof HTMLElement ? computeAccessibleName(focused) : null;
}

function highlightedTitle() {
  return (
    document.querySelector("[data-slot=command-item][data-highlighted] .font-medium")?.textContent ?? null
  );
}

async function openPicker(user: ReturnType<typeof userEvent.setup>) {
  render(<NewChatButton groups={groups} />);
  await user.click(screen.getByRole("button", { name: "New chat" }));
  await waitFor(() => expect(focusedName()).toBe("Search groups"));
}

describe("NewChatButton", () => {
  test("search ranks the best matching group first", async () => {
    const user = userEvent.setup();
    await openPicker(user);

    await user.keyboard("pers");

    await waitFor(() => expect(highlightedTitle()).toBe("Personal"));
  });

  test("Ctrl+1 starts an ungrouped chat", async () => {
    const user = userEvent.setup();
    await openPicker(user);

    await user.keyboard("{Control>}1{/Control}");

    await waitFor(() => expect(navigations).toEqual([{ to: "/" }]));
    expect(useThreadStore.getState().activeGroupId).toBeNull();
  });

  test("Ctrl+2 starts a chat in the first group, even while searching", async () => {
    const user = userEvent.setup();
    await openPicker(user);

    await user.keyboard("pers{Control>}2{/Control}");

    await waitFor(() => expect(navigations).toEqual([{ to: "/" }]));
    expect(useThreadStore.getState().activeGroupId).toBe(testGroupId("group-work"));
  });

  test("reopening starts from an empty search", async () => {
    const user = userEvent.setup();
    await openPicker(user);

    await user.keyboard("pers");
    // An outside press closes with the search still filled; Escape would clear it first.
    const backdrop = document.querySelector("[data-slot=dialog-backdrop]");
    if (!(backdrop instanceof HTMLElement)) throw new Error("Missing dialog backdrop");
    await user.click(backdrop);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await user.click(screen.getByRole("button", { name: "New chat" }));

    await waitFor(() => expect(focusedName()).toBe("Search groups"));
    expect(screen.getByRole("combobox", { name: "Search groups" })).toHaveProperty("value", "");
  });

  test("Escape closes the picker and returns focus to the button", async () => {
    const user = userEvent.setup();
    await openPicker(user);

    await user.keyboard("{Escape}");

    await waitFor(() => expect(focusedName()).toBe("New chat"));
    expect(navigations).toEqual([]);
  });
});
