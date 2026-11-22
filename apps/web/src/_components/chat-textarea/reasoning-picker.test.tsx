import { afterAll, beforeEach, describe, expect, mock, setDefaultTimeout, test } from "bun:test";

setDefaultTimeout(20_000);

// The DOM must exist before Testing Library loads: it binds `screen` to the document when first evaluated.
await import("@/test/dom");
const { render, screen, waitFor } = await import("@testing-library/react");
const { default: userEvent } = await import("@testing-library/user-event");

type SaveCall = {
  threadId: string;
  latestModel?: string;
  latestModelParams?: Partial<{ effort: string; webSearch: boolean; profile: string | null }>;
};

const THREAD_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const MODEL = "openai/gpt-5.6-terra";

const saveCalls: SaveCall[] = [];
let currentThreadId: string | undefined = THREAD_ID;

const actualRouter = await import("@tanstack/react-router");
await mock.module("@tanstack/react-router", () => ({
  ...actualRouter,
  useParams: () => (currentThreadId ? { threadId: currentThreadId } : undefined),
}));
async function mutate(args: SaveCall) {
  saveCalls.push(args);
}
const mutation = Object.assign(mutate, { withOptimisticUpdate: () => mutate });
await mock.module("convex/react", () => ({ useMutation: () => mutation }));

const { ConfigStoreProvider, useConfigStore } = await import("../provider/config-provider");
const { ChatReasoningPicker } = await import("./reasoning-picker");
const { ChatModelSelector } = await import("./model-selector");
const { tryGetModelData } = await import("@/lib/chat/models");

const initialState = {
  model: MODEL,
  modelParams: { effort: "medium" as const, webSearch: false, profile: null },
};

afterAll(() => mock.restore());

beforeEach(() => {
  saveCalls.length = 0;
  currentThreadId = THREAD_ID;
});

function EffortProbe() {
  const effort = useConfigStore((state) => state.modelParams.effort);
  return <output aria-label="Current effort">{effort}</output>;
}

function renderComposer() {
  return render(
    <ConfigStoreProvider initialState={initialState}>
      <EffortProbe />
      <ChatReasoningPicker />
      <ChatModelSelector />
    </ConfigStoreProvider>,
  );
}

async function chooseEffort(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(screen.getByRole("button", { name: "Reasoning effort" }));
  await user.click(await screen.findByRole("button", { name: label }));
  await user.keyboard("{Escape}");
}

async function chooseModel(user: ReturnType<typeof userEvent.setup>, id: string) {
  const data = tryGetModelData(id);
  await user.click(screen.getByRole("button", { name: "Select model" }));
  const search = await screen.findByRole("combobox", { name: "Search models" });
  search.focus();
  await user.paste(data?.display.unique ?? data?.display.name ?? id);
  await user.keyboard("{Enter}");
}

const currentEffort = () => screen.getByRole("status", { name: "Current effort" }).textContent;

describe("composer model settings", () => {
  test("choosing an effort in a thread saves only the effort, at once", async () => {
    const user = userEvent.setup();
    renderComposer();

    await chooseEffort(user, "High");

    expect(currentEffort()).toBe("high");
    expect(saveCalls).toEqual([
      {
        threadId: THREAD_ID.replaceAll("-", ""),
        latestModel: undefined,
        latestModelParams: { effort: "high" },
      },
    ]);
  });

  test("on the welcome page an effort changes the composer and saves nothing", async () => {
    currentThreadId = undefined;
    const user = userEvent.setup();
    renderComposer();

    await chooseEffort(user, "Low");

    expect(currentEffort()).toBe("low");
    expect(saveCalls).toEqual([]);
  });

  test("choosing a model saves only the model and resolves the effort for it", async () => {
    const user = userEvent.setup();
    renderComposer();

    await chooseEffort(user, "Max");
    await chooseModel(user, "openai/gpt-5.5-pro");

    // GPT 5.5 Pro has no Max, so it falls back to its default.
    await waitFor(() => expect(currentEffort()).toBe("medium"));
    expect(saveCalls.at(-1)).toEqual({
      threadId: THREAD_ID.replaceAll("-", ""),
      latestModel: "openai/gpt-5.5-pro",
      latestModelParams: undefined,
    });
  });
});
