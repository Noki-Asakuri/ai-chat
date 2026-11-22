import { afterAll, beforeEach, describe, expect, mock, setDefaultTimeout, test } from "bun:test";

import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import type { OptimisticLocalStore } from "convex/browser";
import type { FunctionReference } from "convex/server";

import type { nextThreadPageMeta as NextThreadPageMeta } from "@/lib/chat/use-update-model-config";
import { fromUUID } from "@/lib/utils";

setDefaultTimeout(20_000);

// The DOM must exist before Testing Library loads: it binds `screen` to the document when first evaluated.
await import("@/test/dom");
const { act, render, screen } = await import("@testing-library/react");
const { default: userEvent } = await import("@testing-library/user-event");
const { useEffect, useState } = await import("react");

type ThreadMeta = Parameters<typeof NextThreadPageMeta>[0];
type SaveArgs = Parameters<typeof NextThreadPageMeta>[1];
type OptimisticUpdate = (store: OptimisticLocalStore, args: SaveArgs) => void;
type PendingSave = {
  args: SaveArgs;
  update: OptimisticUpdate;
  resolve: () => void;
  reject: () => void;
};

const THREAD_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const MODEL = "openai/gpt-5.6-terra";
// Routes use the UUID form; saves use the Convex ID form.
const SAVED_THREAD_ID = fromUUID<Id<"threads">>(THREAD_ID);
const SERVER_META: ThreadMeta = {
  title: "Thread",
  groupId: null,
  groupTitle: null,
  pinned: false,
  settled: false,
  isShared: false,
  status: "complete",
  updatedAt: 0,
  lastViewedAt: null,
  latestModel: MODEL,
  latestModelParams: { effort: "medium", webSearch: false, profile: null },
};

let currentThreadId: string | undefined = THREAD_ID;
let serverMeta = SERVER_META;
let pending: PendingSave[] = [];
let showMeta: (meta: ThreadMeta) => void = () => {};

/**
 * Like Convex's local store: the query result is the server value with every pending mutation's
 * optimistic update replayed on top, in order. A settled mutation drops its update.
 */
function publishQueryResult() {
  let view = serverMeta;
  const localStore = {
    getQuery: () => view,
    setQuery: (_query: FunctionReference<"query">, _args: { threadId: Id<"threads"> }, value: ThreadMeta) => {
      view = value;
    },
  };
  // @ts-expect-error -- a minimal fake of Convex's OptimisticLocalStore
  for (const save of pending) save.update(localStore, save.args);
  act(() => showMeta(view));
}

const fakeConvex = {
  mutation: (
    _mutation: FunctionReference<"mutation">,
    args: SaveArgs,
    options: { optimisticUpdate: OptimisticUpdate },
  ) =>
    new Promise<null>((resolve, reject) => {
      const save: PendingSave = {
        args,
        update: options.optimisticUpdate,
        resolve: () => {
          serverMeta = nextThreadPageMeta(serverMeta, args) ?? serverMeta;
          pending = pending.filter((item) => item !== save);
          publishQueryResult();
          resolve(null);
        },
        reject: () => {
          pending = pending.filter((item) => item !== save);
          publishQueryResult();
          reject(new Error("save failed"));
        },
      };
      pending.push(save);
      publishQueryResult();
    }),
};

const actualRouter = await import("@tanstack/react-router");
await mock.module("@tanstack/react-router", () => ({
  ...actualRouter,
  useParams: () => (currentThreadId ? { threadId: currentThreadId } : undefined),
}));
await mock.module("convex/react", () => ({
  useConvex: () => fakeConvex,
  useMutation: () => async () => {},
}));

const { ConfigStoreProvider, useConfigStore } = await import("../provider/config-provider");
const { ChatReasoningPicker } = await import("./reasoning-picker");
const { ChatModelSelector } = await import("./model-selector");
const { tryGetModelData } = await import("@/lib/chat/models");
const { nextThreadPageMeta } = await import("@/lib/chat/use-update-model-config");

afterAll(() => mock.restore());

beforeEach(() => {
  currentThreadId = THREAD_ID;
  serverMeta = SERVER_META;
  pending = [];
});

function EffortProbe() {
  const effort = useConfigStore((state) => state.modelParams.effort);
  return <output aria-label="Current effort">{effort}</output>;
}

// Mirrors the chat layout: the thread's query result feeds the provider's initial state.
function Composer() {
  const [meta, setMeta] = useState(serverMeta);
  useEffect(() => {
    showMeta = setMeta;
  }, []);
  return (
    <ConfigStoreProvider
      initialState={{
        model: meta.latestModel,
        modelParams: { ...meta.latestModelParams, profile: meta.latestModelParams.profile ?? null },
      }}
    >
      <EffortProbe />
      <ChatReasoningPicker />
      <ChatModelSelector />
    </ConfigStoreProvider>
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

async function settle(index: number, outcome: "resolve" | "reject") {
  const save = pending.at(index);
  if (!save) throw new Error(`No pending save at ${index}`);
  await act(async () => {
    save[outcome]();
    await Promise.resolve();
  });
}

const currentEffort = () => screen.getByRole("status", { name: "Current effort" }).textContent;

describe("composer model settings in a thread", () => {
  test("an effort shows at once through the optimistic update and saves only the effort", async () => {
    const user = userEvent.setup();
    render(<Composer />);

    await chooseEffort(user, "High");

    expect(currentEffort()).toBe("high");
    expect(pending.map((save) => save.args)).toEqual([
      {
        threadId: SAVED_THREAD_ID,
        latestModel: undefined,
        latestModelParams: { effort: "high" },
      },
    ]);

    await settle(0, "resolve");
    expect(currentEffort()).toBe("high");
  });

  test("an older save resolving does not replace a newer pending choice", async () => {
    const user = userEvent.setup();
    render(<Composer />);

    await chooseEffort(user, "High");
    await chooseEffort(user, "Low");
    await settle(0, "resolve");

    expect(currentEffort()).toBe("low");
  });

  test("a failed save restores the saved value", async () => {
    const user = userEvent.setup();
    render(<Composer />);

    await chooseEffort(user, "High");
    await settle(0, "reject");

    expect(currentEffort()).toBe("medium");
  });

  test("a model change saves only the model and resolves the effort for it", async () => {
    const user = userEvent.setup();
    render(<Composer />);

    await chooseEffort(user, "Max");
    await chooseModel(user, "openai/gpt-5.5-pro");

    // GPT 5.5 Pro has no Max, so it falls back to its default.
    expect(currentEffort()).toBe("medium");
    expect(pending.at(-1)?.args).toEqual({
      threadId: SAVED_THREAD_ID,
      latestModel: "openai/gpt-5.5-pro",
      latestModelParams: undefined,
    });
  });
});

describe("composer model settings on the welcome page", () => {
  test("an effort changes the composer and saves nothing", async () => {
    currentThreadId = undefined;
    const user = userEvent.setup();
    render(<Composer />);

    await chooseEffort(user, "Low");

    expect(currentEffort()).toBe("low");
    expect(pending).toEqual([]);
  });
});
