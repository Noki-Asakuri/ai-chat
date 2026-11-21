import { afterAll, beforeEach, describe, expect, mock, setDefaultTimeout, test } from "bun:test";

import type { NavigateCall } from "@/test/fixtures";

// Each test renders the full palette in happy-dom; on a busy CI worker the first render alone can pass 5s.
setDefaultTimeout(20_000);

// The DOM must exist before Testing Library loads: it binds `screen` to the document when first evaluated.
await import("@/test/dom");
const { testGroupId } = await import("@/test/fixtures");
const { act, render, screen, waitFor } = await import("@testing-library/react");
const { default: userEvent } = await import("@testing-library/user-event");
const { computeAccessibleName } = await import("dom-accessibility-api");

type FakeThread = { _id: string; title: string; updatedAt: number };

const navigations: NavigateCall[] = [];
let serverThreads: FakeThread[] = [];
const THREAD_ID = "0123456789abcdef0123456789abcdef";
const groups = [
  { _id: testGroupId("group-work"), title: "Work" },
  { _id: testGroupId("group-home"), title: "Personal" },
];

const actualRouter = await import("@tanstack/react-router");
const actualQuery = await import("@tanstack/react-query");

await mock.module("@tanstack/react-router", () => ({
  ...actualRouter,
  useNavigate: () => async (options: NavigateCall) => {
    navigations.push(options);
  },
  useParams: () => undefined,
}));
await mock.module("@tanstack/react-query", () => ({
  ...actualQuery,
  useQuery: (options: { enabled?: boolean }) => ({
    data: options.enabled ? serverThreads : undefined,
    isFetching: false,
  }),
}));
await mock.module("@/lib/threads/use-thread-groups", () => ({
  useThreadGroups: () => ({ data: { groups, threads: [] } }),
}));

const { createAgent } = await import("@ui-sdk/react/agent");
const { threadStoreActions, useThreadStore } = await import("@/lib/store/thread-store");
const { ThreadCommandDialog } = await import("./thread-command");

const agent = createAgent();

afterAll(() => mock.restore());

beforeEach(() => {
  navigations.length = 0;
  serverThreads = [];
  act(() => {
    threadStoreActions.setActiveGroupId(null);
    threadStoreActions.setThreadCommandOpen(false);
  });
});

function focusedName() {
  const focused = document.activeElement;
  return focused instanceof HTMLElement ? computeAccessibleName(focused) : null;
}

function highlightedText() {
  return document.querySelector("[data-slot=command-item][data-highlighted]")?.textContent?.trim() ?? null;
}

function statusText() {
  return document.querySelector("[data-slot=command-status]")?.textContent ?? null;
}

function visibleItems() {
  return [...document.querySelectorAll<HTMLElement>("[data-slot=command-item]")]
    .filter((item) => !item.hidden && !item.closest("[hidden]"))
    .map((item) => item.textContent?.trim());
}

async function openPalette() {
  render(<ThreadCommandDialog />);
  act(() => threadStoreActions.setThreadCommandOpen(true));
  await waitFor(() => expect(focusedName()).toBe("Search commands and threads"));
}

describe("ThreadCommandDialog", () => {
  test("opens with focus in a named search field", async () => {
    await openPalette();
    expect(screen.getByRole("dialog", { name: "Command palette" })).toBeTruthy();
    expect(highlightedText()).toContain("New thread in");
  });

  test("ranks the best match first while searching", async () => {
    const user = userEvent.setup();
    await openPalette();

    await user.keyboard("acc");

    await waitFor(() => expect(highlightedText()).toBe("Account"));
  });

  test("shows server thread results without filtering them again", async () => {
    serverThreads = [{ _id: THREAD_ID, title: "Quarterly planning notes", updatedAt: 1 }];
    const user = userEvent.setup();
    await openPalette();

    await user.paste("roadmap");

    await waitFor(() => expect(visibleItems()).toContain("Quarterly planning notes"));
    expect(screen.getByText("Search results")).toBeTruthy();
  });

  test("choosing a thread navigates to it and closes the palette", async () => {
    serverThreads = [{ _id: THREAD_ID, title: "Quarterly planning notes", updatedAt: 1 }];
    const user = userEvent.setup();
    await openPalette();

    await user.paste("quarterly");
    await waitFor(() => expect(highlightedText()).toBe("Quarterly planning notes"));
    await user.keyboard("{Enter}");

    await waitFor(() => expect(useThreadStore.getState().threadCommandOpen).toBe(false));
    expect(navigations).toEqual([
      { to: "/threads/$threadId", params: { threadId: "01234567-89ab-cdef-0123-456789abcdef" } },
    ]);
  });

  test("New thread in… opens the groups page; Escape clears, then goes back", async () => {
    const user = userEvent.setup();
    await openPalette();

    await user.keyboard("{ArrowDown}{Enter}");
    await waitFor(() => expect(focusedName()).toBe("Search groups"));
    expect(visibleItems()).toEqual(["Ungrouped", "Work", "Personal", "Back to threads"]);

    await user.keyboard("pers");
    await waitFor(() => expect(highlightedText()).toBe("Personal"));
    await user.keyboard("{Escape}");
    await waitFor(() => expect(visibleItems()).toContain("Work"));
    await user.keyboard("{Escape}");

    await waitFor(() => expect(focusedName()).toBe("Search commands and threads"));
    expect(useThreadStore.getState().threadCommandOpen).toBe(true);
  });

  test("choosing a group starts a new thread in it", async () => {
    const user = userEvent.setup();
    await openPalette();

    await user.keyboard("{ArrowDown}{Enter}");
    await waitFor(() => expect(focusedName()).toBe("Search groups"));
    await user.keyboard("work{Enter}");

    await waitFor(() => expect(useThreadStore.getState().threadCommandOpen).toBe(false));
    expect(useThreadStore.getState().activeGroupId).toBe(testGroupId("group-work"));
    expect(navigations).toEqual([{ to: "/" }]);
  });

  test("Ctrl+Shift+O starts a new thread in the active group", async () => {
    act(() => threadStoreActions.setActiveGroupId(testGroupId("group-home")));
    const user = userEvent.setup();
    await openPalette();

    await user.keyboard("{Control>}{Shift>}O{/Shift}{/Control}");

    await waitFor(() => expect(navigations).toEqual([{ to: "/" }]));
    expect(useThreadStore.getState().activeGroupId).toBe(testGroupId("group-home"));
  });

  test("reopening after an outside close starts from an empty search on the first page", async () => {
    const user = userEvent.setup();
    await openPalette();

    await user.keyboard("{ArrowDown}{Enter}");
    await waitFor(() => expect(focusedName()).toBe("Search groups"));
    await user.keyboard("wor");
    act(() => threadStoreActions.setThreadCommandOpen(false));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    act(() => threadStoreActions.setThreadCommandOpen(true));

    await waitFor(() => expect(focusedName()).toBe("Search commands and threads"));
    expect(screen.getByRole("combobox", { name: "Search commands and threads" })).toHaveProperty("value", "");
  });

  test("the status announces the result count once loading finishes", async () => {
    serverThreads = [{ _id: THREAD_ID, title: "Quarterly planning notes", updatedAt: 1 }];
    const user = userEvent.setup();
    await openPalette();

    await user.paste("quarterly");
    expect(statusText()).toContain("Fetching threads");

    await waitFor(() => expect(statusText()).toBe("1 result"));
  });

  test("Escape with an empty search closes the palette", async () => {
    const user = userEvent.setup();
    await openPalette();

    await user.keyboard("{Escape}");

    await waitFor(() => expect(useThreadStore.getState().threadCommandOpen).toBe(false));
  });

  test("an agent can find and run a settings command", async () => {
    await openPalette();

    const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more");
    for (const entry of components) {
      expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy();
    }

    const found = await agent.query({ within: "Search commands and threads", text: "Account" });
    if ("error" in found) throw new Error(found.error);
    const account = found[0]?.items?.find((item) => item.label === "Account");
    if (!account) throw new Error("The agent can't find the Account command");

    const result = await act(() =>
      agent.act({ steps: [{ ref: "Search commands and threads", action: "run", args: [account.value] }] }),
    );
    expect(result.ok, result.error?.message).toBe(true);
    await waitFor(() => expect(useThreadStore.getState().threadCommandOpen).toBe(false));
    expect(navigations).toEqual([{ to: "/settings/account", search: { rt: undefined } }]);
  });
});
