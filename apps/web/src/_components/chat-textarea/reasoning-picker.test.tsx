import { afterAll, afterEach, beforeEach, describe, expect, mock, setDefaultTimeout, test } from "bun:test";

setDefaultTimeout(20_000);

// The DOM must exist before Testing Library loads: it binds `screen` to the document when first evaluated.
await import("@/test/dom");
const { act, render, screen, waitFor } = await import("@testing-library/react");
const { useEffect } = await import("react");
const { default: userEvent } = await import("@testing-library/user-event");

type SyncCall = { threadId: string; model: string; modelParams: { effort: string; webSearch: boolean } };

const THREAD_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const THREAD_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const SYNC_WAIT_MS = 1_000;

const syncCalls: SyncCall[] = [];
let currentThreadId: string | undefined = THREAD_A;

const actualRouter = await import("@tanstack/react-router");
await mock.module("@tanstack/react-router", () => ({
  ...actualRouter,
  useParams: () => (currentThreadId ? { threadId: currentThreadId } : undefined),
}));
await mock.module("@/lib/trpc/client", () => ({
  syncThreadModelConfig: async (input: SyncCall) => {
    syncCalls.push(input);
  },
}));

const { ConfigStoreProvider, useConfigStoreApi } = await import("../provider/config-provider");
const { ChatReasoningPicker } = await import("./reasoning-picker");

const initialState = { model: "google/gemini-2.5-pro" };

afterAll(() => mock.restore());

beforeEach(() => {
  syncCalls.length = 0;
  currentThreadId = THREAD_A;
});

// Unmounting queues a React scheduler task; let it run before the shared setup removes the DOM.
afterEach(() => new Promise((resolve) => setTimeout(resolve, 20)));

type ConfigStoreApi = ReturnType<typeof useConfigStoreApi>;
let store: ConfigStoreApi | undefined;

function StoreProbe() {
  const api = useConfigStoreApi();
  useEffect(() => {
    store = api;
  }, [api]);
  return null;
}

// Production keys the provider by thread ID, so switching threads remounts the picker with a new store.
function pickerTree() {
  return (
    <ConfigStoreProvider key={currentThreadId} initialState={initialState}>
      <StoreProbe />
      <ChatReasoningPicker />
    </ConfigStoreProvider>
  );
}

function renderPicker() {
  return render(pickerTree());
}

async function chooseEffort(user: ReturnType<typeof userEvent.setup>, label: string) {
  const trigger = screen.getByRole("button", { name: "Reasoning effort" });
  if (trigger.getAttribute("aria-expanded") !== "true") await user.click(trigger);
  await user.click(await screen.findByRole("button", { name: label }));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("reasoning effort sync", () => {
  test("waits, then syncs the last choice once", async () => {
    const user = userEvent.setup();
    renderPicker();

    await chooseEffort(user, "High");
    await chooseEffort(user, "Low");
    expect(syncCalls).toHaveLength(0);

    await waitFor(() => expect(syncCalls).toHaveLength(1), { timeout: SYNC_WAIT_MS * 2 });
    expect(syncCalls[0]).toMatchObject({
      threadId: THREAD_A.replaceAll("-", ""),
      model: "google/gemini-2.5-pro",
      modelParams: { effort: "low", webSearch: false },
    });
    await sleep(SYNC_WAIT_MS + 100);
    expect(syncCalls).toHaveLength(1);
  });

  test("switching threads sends the pending choice to the thread it was made in", async () => {
    const user = userEvent.setup();
    const view = renderPicker();

    await chooseEffort(user, "High");
    currentThreadId = THREAD_B;
    act(() => view.rerender(pickerTree()));

    await waitFor(() => expect(syncCalls).toHaveLength(1), { timeout: 200 });
    expect(syncCalls[0]?.threadId).toBe(THREAD_A.replaceAll("-", ""));
    expect(syncCalls[0]?.modelParams.effort).toBe("high");

    await sleep(SYNC_WAIT_MS + 100);
    expect(syncCalls).toHaveLength(1);
  });

  test("a setting changed during the wait is not undone by the sync", async () => {
    const user = userEvent.setup();
    renderPicker();

    await chooseEffort(user, "High");
    act(() => store?.getState().setModelParams({ webSearch: true }));

    await waitFor(() => expect(syncCalls).toHaveLength(1), { timeout: SYNC_WAIT_MS * 2 });
    expect(syncCalls[0]?.modelParams).toMatchObject({ effort: "high", webSearch: true });
  });

  test("sends a pending choice at once when the picker unmounts", async () => {
    const user = userEvent.setup();
    const view = renderPicker();

    await chooseEffort(user, "High");
    expect(syncCalls).toHaveLength(0);
    act(() => view.unmount());

    await waitFor(() => expect(syncCalls).toHaveLength(1), { timeout: 200 });
    expect(syncCalls[0]).toMatchObject({
      threadId: THREAD_A.replaceAll("-", ""),
      modelParams: { effort: "high" },
    });
  });

  test("unmounting with nothing pending sends nothing", async () => {
    const view = renderPicker();
    act(() => view.unmount());

    await sleep(100);
    expect(syncCalls).toHaveLength(0);
  });
});
