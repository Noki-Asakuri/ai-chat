import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  setDefaultTimeout,
  spyOn,
  test,
} from "bun:test";

// The composer renders the full model picker in happy-dom; on a busy CI worker that can pass 5s.
setDefaultTimeout(20_000);

// The DOM must exist before Testing Library loads: it binds `screen` to the document when first evaluated.
await import("@/test/dom");
const { act, fireEvent, render, screen, waitFor } = await import("@testing-library/react");
const { default: userEvent } = await import("@testing-library/user-event");

import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";
import {
  applyThreadModelConfigPatch,
  readStoredThreadModelConfig,
} from "@ai-chat/shared/chat/thread-model-config";

import type { FunctionReturnType } from "convex/server";
import { useEffect, type ReactNode } from "react";

import { fromUUID } from "@/lib/utils";
import { FakeConvexClient } from "@/test/fake-convex-client";

process.env.VITE_API_ENDPOINT ??= "http://localhost";

const THREAD_UUID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const THREAD_ID = fromUUID<Id<"threads">>(THREAD_UUID);
const NEW_THREAD_ID = fromUUID<Id<"threads">>("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");

let currentThreadUUID: string | undefined;
let convex = new FakeConvexClient();
let respondToChat: () => Promise<Response>;
const toasts: Array<{ title: string; options?: { actionProps?: { onClick?: () => void } } }> = [];

const actualRouter = await import("@tanstack/react-router");
await mock.module("@tanstack/react-router", () => ({
  ...actualRouter,
  useParams: () => (currentThreadUUID ? { threadId: currentThreadUUID } : undefined),
  useNavigate: () => async () => {},
}));
await mock.module("@/lib/convex/client", () => ({ getConvexReactClient: () => convex.asReactClient() }));
await mock.module("@/components/ui/toast", () => ({
  toast: {
    error: (title: string, options?: (typeof toasts)[number]["options"]) => toasts.push({ title, options }),
  },
}));
await mock.module("@/lib/chat/stream-feedback", () => ({ emitStreamFeedback: () => {} }));

const { api } = await import("@ai-chat/backend/convex/_generated/api");
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
const { ConvexQueryClient } = await import("@convex-dev/react-query");
const { ConvexProvider } = await import("convex/react");
const { ConfigStoreProvider } = await import("@/components/provider/config-provider");
const { ChatActionButtons } = await import("@/components/chat-textarea/action-buttons");
const { useSendChatMessage } = await import("@/lib/chat/server-function/send-chat-message");
const { chatStoreActions } = await import("@/lib/store/chat-store");
const { tryGetModelData } = await import("@/lib/chat/models");

const getMeta = api.functions.threads.getThreadPageMeta;
const metaArgs = { threadId: THREAD_ID };
type Meta = FunctionReturnType<typeof getMeta>;

function serverMeta(): Meta | undefined {
  return convex.getServerQuery(getMeta, metaArgs);
}

function setUpServer() {
  convex = new FakeConvexClient();
  convex.setServerQuery(getMeta, metaArgs, {
    title: "Thread",
    groupId: null,
    groupTitle: null,
    pinned: false,
    settled: false,
    isShared: false,
    status: "complete",
    updatedAt: 1,
    lastViewedAt: null,
    latestModel: "openai/gpt-5",
    latestModelParams: { effort: "medium", webSearch: false, profile: null },
  });

  // The same merge the backend mutation runs.
  convex.onMutation(api.functions.threads.updateThreadModelConfig, ({ threadId, ...patch }) => {
    const meta = convex.getServerQuery(getMeta, { threadId });
    if (!meta) throw new Error("Thread not found");
    const next = applyThreadModelConfigPatch(
      readStoredThreadModelConfig(meta.latestModel, meta.latestModelParams),
      patch,
    );
    const nextMeta = { ...meta, latestModel: next.model, latestModelParams: next.modelParams };
    convex.setServerQuery(getMeta, { threadId }, nextMeta, false);
    return null;
  });
  convex.onMutation(api.functions.messages.addMessagesToThread, () =>
    fromUUID<Id<"messages">>("cccccccc-cccc-cccc-cccc-cccccccccccc"),
  );
  convex.onMutation(api.functions.threads.createThread, () => NEW_THREAD_ID);
}

function Providers({ children }: { children: ReactNode }) {
  const client = convex.asReactClient();
  const convexQueryClient = new ConvexQueryClient(client);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { queryKeyHashFn: convexQueryClient.hashFn(), queryFn: convexQueryClient.queryFn() },
    },
  });
  convexQueryClient.connect(queryClient);

  return (
    <ConvexProvider client={client}>
      <QueryClientProvider client={queryClient}>
        <ConfigStoreProvider
          initialState={{}}
          newThread={{
            model: "openai/gpt-5",
            modelParams: { effort: "medium", webSearch: false, profile: null },
          }}
        >
          {children}
        </ConfigStoreProvider>
      </QueryClientProvider>
    </ConvexProvider>
  );
}

// The send handler from the latest committed render.
const sendRef = { current: async () => {} };
function SendProbe() {
  const { sendChatRequest } = useSendChatMessage();
  useEffect(() => {
    sendRef.current = sendChatRequest;
  });
  return null;
}

async function renderComposer() {
  const view = render(
    <Providers>
      <ChatActionButtons />
      <SendProbe />
    </Providers>,
  );
  // Wait for the thread's own settings (or the welcome defaults) to show.
  await screen.findByRole("button", { name: "Reasoning effort" });
  return view;
}

const effortShown = () => screen.getByRole("button", { name: "Reasoning effort" }).textContent?.trim();
const webSearchShown = () => screen.queryByRole("button", { name: "Disable Web Search" }) !== null;
const labelOf = (id: string) =>
  tryGetModelData(id)?.display.unique ?? tryGetModelData(id)?.display.name ?? id;

async function openEffortMenu(user: ReturnType<typeof userEvent.setup>) {
  const trigger = screen.getByRole("button", { name: "Reasoning effort" });
  if (trigger.getAttribute("aria-expanded") !== "true") await user.click(trigger);
}

async function chooseEffort(user: ReturnType<typeof userEvent.setup>, label: string) {
  await openEffortMenu(user);
  await user.click(await screen.findByRole("button", { name: label }));
}

async function chooseModel(user: ReturnType<typeof userEvent.setup>, modelId: string) {
  await user.click(screen.getByRole("button", { name: "Select model" }));
  await user.click(await screen.findByRole("option", { name: labelOf(modelId) }));
}

/** Lets the "server" run every mutation a flow sends, until the flow finishes. */
async function runToCompletion(flow: Promise<void>) {
  const finished = flow.then(() => true);
  await act(async () => {
    await convex.settleAll();
    await new Promise((resolve) => setTimeout(resolve, 5));
  });
  // `finished` comes first, so it wins the race once the flow is done.
  if (!(await Promise.race([finished, Promise.resolve(false)]))) await runToCompletion(flow);
}

const settingsSaves = () => convex.callsOf(api.functions.threads.updateThreadModelConfig);
let chatRequests: string[] = [];

beforeEach(() => {
  setUpServer();
  currentThreadUUID = THREAD_UUID;
  toasts.length = 0;
  chatRequests = [];
  respondToChat = async () => {
    throw new DOMException("Aborted", "AbortError");
  };
  const fetchChat = async (_input: RequestInfo | URL, init?: RequestInit) => {
    chatRequests.push(String(init?.body));
    return respondToChat();
  };
  spyOn(globalThis, "fetch").mockImplementation(Object.assign(fetchChat, { preconnect: fetch.preconnect }));
});

// Unmounting queues a React scheduler task; let it run before the shared setup removes the DOM.
afterEach(() => new Promise((resolve) => setTimeout(resolve, 20)));
afterAll(() => mock.restore());

describe("composer model settings in a thread", () => {
  test("quick changes each save only their setting, and none undoes another", async () => {
    const user = userEvent.setup();
    await renderComposer();
    expect(effortShown()).toBe("Medium");

    await chooseEffort(user, "High");
    await user.click(screen.getByRole("button", { name: "Enable Web Search" }));

    // Both changes show at once, before either save has reached the server.
    expect(convex.pending).toBe(2);
    expect(effortShown()).toBe("High");
    expect(webSearchShown()).toBe(true);
    expect(settingsSaves()).toEqual([
      { threadId: THREAD_ID, effort: "high" },
      { threadId: THREAD_ID, webSearch: true },
    ]);

    // An unrelated server push still carrying the old settings doesn't put them back on screen.
    const before = serverMeta();
    if (!before) throw new Error("Missing thread meta");
    act(() => convex.setServerQuery(getMeta, metaArgs, { ...before, title: "Renamed" }));
    expect(effortShown()).toBe("High");
    expect(webSearchShown()).toBe(true);

    await act(() => convex.settleAll());
    expect(serverMeta()?.latestModelParams).toEqual({ effort: "high", webSearch: true, profile: null });
    expect(effortShown()).toBe("High");
    expect(webSearchShown()).toBe(true);
  });

  test("a model change saves only the model; the effort is resolved for it on both sides", async () => {
    const user = userEvent.setup();
    await renderComposer();

    await chooseEffort(user, "Low");
    // Kimi K2.6 offers only None and Medium, so Low becomes its default, Medium.
    await chooseModel(user, "kimi/kimi-k2.6");

    expect(settingsSaves().at(-1)).toEqual({ threadId: THREAD_ID, model: "kimi/kimi-k2.6" });
    await waitFor(() => expect(effortShown()).toBe("Medium"));

    await act(() => convex.settleAll());
    expect(serverMeta()).toMatchObject({
      latestModel: "kimi/kimi-k2.6",
      latestModelParams: { effort: "medium", webSearch: false, profile: null },
    });
    expect(effortShown()).toBe("Medium");
  });

  test("a failed save goes back to showing the saved value", async () => {
    const user = userEvent.setup();
    await renderComposer();

    await chooseEffort(user, "High");
    expect(effortShown()).toBe("High");

    await act(() => convex.failNext("Network down"));
    await waitFor(() => expect(effortShown()).toBe("Medium"));
    expect(serverMeta()?.latestModelParams.effort).toBe("medium");
    expect(toasts.map((t) => t.title)).toContain("Couldn't save model settings");
  });

  test("a failed save doesn't undo a later change that succeeded", async () => {
    const user = userEvent.setup();
    await renderComposer();

    await chooseEffort(user, "High");
    await user.click(screen.getByRole("button", { name: "Enable Web Search" }));

    await act(() => convex.failNext());
    await act(() => convex.succeedNext());

    await waitFor(() => expect(effortShown()).toBe("Medium"));
    expect(webSearchShown()).toBe(true);
    expect(serverMeta()?.latestModelParams).toEqual({ effort: "medium", webSearch: true, profile: null });
  });

  test("sending right after a change, before it renders, uses it and leaves the saved settings alone", async () => {
    const user = userEvent.setup();
    await renderComposer();
    chatStoreActions.setInput("Hello");

    await openEffortMenu(user);
    const high = await screen.findByRole("button", { name: "High" });
    const staleSend = sendRef.current;

    let sending!: Promise<void>;
    // One synchronous batch: React hasn't re-rendered, so `staleSend` is from before the change.
    act(() => {
      fireEvent.click(high);
      sending = staleSend();
    });
    await runToCompletion(sending);

    const [addMessages] = convex.callsOf(api.functions.messages.addMessagesToThread);
    expect(addMessages?.messages[1]?.metadata?.modelParams).toEqual({
      effort: "high",
      webSearch: false,
      profile: null,
    });
    expect(JSON.parse(chatRequests[0] ?? "{}")).toMatchObject({
      model: "openai/gpt-5",
      modelParams: { effort: "high" },
    });

    // The send itself saves nothing; only the picker's own change was saved.
    expect(settingsSaves()).toEqual([{ threadId: THREAD_ID, effort: "high" }]);
    expect(serverMeta()?.latestModelParams.effort).toBe("high");
  });

  test("the deprecated-model toast saves the replacement model for the thread", async () => {
    await renderComposer();
    chatStoreActions.setInput("Hello");
    respondToChat = async () =>
      new Response(
        JSON.stringify({
          error: {
            message: "This model is deprecated",
            code: "MODEL_DEPRECATED",
            details: { modelId: "openai/gpt-5", replacementModelId: "openai/gpt-5.5" },
          },
        }),
        { status: 410 },
      );

    await runToCompletion(sendRef.current());
    const deprecated = toasts.find((t) => t.title === "Selected model is deprecated");
    expect(deprecated).toBeDefined();

    act(() => deprecated?.options?.actionProps?.onClick?.());
    expect(settingsSaves()).toEqual([{ threadId: THREAD_ID, model: "openai/gpt-5.5" }]);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Select model" }).textContent).toContain(
        labelOf("openai/gpt-5.5"),
      ),
    );

    await act(() => convex.settleAll());
    expect(serverMeta()?.latestModel).toBe("openai/gpt-5.5");
  });
});

describe("composer model settings on the welcome page", () => {
  test("changes stay local and the first message creates the thread with them", async () => {
    currentThreadUUID = undefined;
    const user = userEvent.setup();
    await renderComposer();

    await chooseEffort(user, "High");
    await user.click(screen.getByRole("button", { name: "Enable Web Search" }));
    expect(effortShown()).toBe("High");
    expect(webSearchShown()).toBe(true);
    expect(convex.mutations).toHaveLength(0);

    chatStoreActions.setInput("Hello");
    await runToCompletion(sendRef.current());

    const [createThread] = convex.callsOf(api.functions.threads.createThread);
    expect(createThread).toMatchObject({
      latestModel: "openai/gpt-5",
      latestModelParams: { effort: "high", webSearch: true, profile: null },
    });
    expect(settingsSaves()).toHaveLength(0);
  });
});
