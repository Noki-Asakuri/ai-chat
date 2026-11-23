import type { FunctionReference } from "convex/server";
import { afterAll, beforeEach, describe, expect, mock, setDefaultTimeout, test } from "bun:test";

setDefaultTimeout(20_000);

await import("@/test/dom");
const { act, render, screen, waitFor } = await import("@testing-library/react");
const { default: userEvent } = await import("@testing-library/user-event");

const profiles = [
  { _id: "profile_writer", name: "Writer", systemPrompt: "", userId: "u", createdAt: 0, updatedAt: 0 },
  { _id: "profile_coder", name: "Coder", systemPrompt: "", userId: "u", createdAt: 0, updatedAt: 0 },
];

const attachments = [
  {
    _id: "attachment_report",
    _creationTime: 1,
    id: "a1",
    name: "report.pdf",
    size: 2048,
    type: "pdf",
    source: "user",
    mimeType: "application/pdf",
    path: "u/t/a1.pdf",
    threadId: "thread_1",
    userId: "u",
    thread: { _id: "thread_1", title: "Quarterly numbers" },
  },
];

const attachmentQueries: Array<{ search?: string }> = [];
await mock.module("convex/react", () => ({
  useConvex: () => ({
    query: async (_ref: FunctionReference<"query">, args: { search?: string }) => {
      attachmentQueries.push(args);
      return { items: attachments.filter((item) => item.name.includes(args.search ?? "")) };
    },
  }),
}));

await mock.module("@convex-dev/react-query", () => ({
  convexQuery: () => ({ queryKey: ["profiles"], queryFn: async () => profiles }),
}));

await mock.module("@/lib/assets/urls", () => ({
  buildAttachmentUrl: (path: string) => `https://files.test/${path}`,
  buildImageAssetUrl: (path: string) => `https://assets.test/${path}`,
  buildImageThumbnailUrl: (url: string) => url,
}));

const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
const { createAgent } = await import("@ui-sdk/react/agent");
const { ConfigStoreContext } = await import("@/components/provider/config-provider");
const { createConfigStore } = await import("@/lib/store/config-store");
const { SelectableModelIds, tryGetModelData } = await import("@/lib/chat/models");
const { parseComposerInput } = await import("@/lib/chat/composer-tokens");
const { RichComposer } = await import("./rich-composer");

afterAll(() => mock.restore());

const fileModel = SelectableModelIds.find((id) => tryGetModelData(id)?.modalities.input.includes("pdf"));
if (!fileModel) throw new Error("Expected a model that accepts PDFs");

function renderComposer(options: { pref?: "enter" | "ctrlEnter"; input?: string } = {}) {
  const store = createConfigStore({ model: fileModel, pref: options.pref ?? "enter" });
  const queryClient = new QueryClient();
  const state = { input: options.input ?? "" };
  const onConfirm = mock(() => {});
  const setInput = mock((next: string) => {
    state.input = next;
  });

  function view(input: string) {
    return (
      <QueryClientProvider client={queryClient}>
        <ConfigStoreContext.Provider value={store}>
          <RichComposer
            id="composer"
            input={input}
            setInput={setInput}
            model={fileModel!}
            handleAddAttachments={() => {}}
            onConfirm={onConfirm}
            enableProfiles
          />
        </ConfigStoreContext.Provider>
      </QueryClientProvider>
    );
  }

  const result = render(view(state.input));
  const rerenderWith = (input: string) => result.rerender(view(input));
  return { ...result, state, onConfirm, setInput, rerenderWith };
}

function editor() {
  return screen.getByRole("textbox", { name: "Type your message here..." });
}

beforeEach(() => {
  attachmentQueries.length = 0;
});

describe("RichComposer", () => {
  test("is a named multiline textbox that reports plain text", async () => {
    const user = userEvent.setup();
    const { state } = renderComposer();

    expect(editor().getAttribute("aria-multiline")).toBe("true");
    await user.click(editor());
    await user.keyboard("Hello there");

    await waitFor(() => expect(state.input).toBe("Hello there"));
  });

  test("Enter sends with the Enter preference and adds a line with Ctrl+Enter preference", async () => {
    const user = userEvent.setup();
    const first = renderComposer();
    await user.click(editor());
    await user.keyboard("Hi{Enter}");
    expect(first.onConfirm).toHaveBeenCalledTimes(1);
    first.unmount();

    const second = renderComposer({ pref: "ctrlEnter" });
    await user.click(editor());
    await user.keyboard("Hi{Enter}");
    expect(second.onConfirm).not.toHaveBeenCalled();
    await user.keyboard("{Control>}{Enter}{/Control}");
    expect(second.onConfirm).toHaveBeenCalledTimes(1);
  });

  test("follows input that changes outside the editor", async () => {
    const { rerenderWith } = renderComposer({ input: "Draft" });
    expect(editor().textContent).toContain("Draft");

    act(() => rerenderWith(""));
    await waitFor(() => expect(editor().textContent).not.toContain("Draft"));
  });

  test("starts with chips for tokens in the saved draft", () => {
    renderComposer({ input: "Summarize [@report.pdf](file:attachment_report)" });
    const chip = editor().querySelector('[data-slot="token-input-token"][data-token-type="file"]');
    expect(chip?.textContent).toContain("report.pdf");
  });

  test("/ at the start picks a profile and stores it as a profile token", async () => {
    const user = userEvent.setup();
    const { state } = renderComposer();
    await waitFor(() => expect(editor().getAttribute("aria-placeholder")).toContain("/ for a profile"));

    await user.click(editor());
    await user.keyboard("/Cod");
    const option = await screen.findByRole("option", { name: /Coder/ });
    expect(option).toBeTruthy();
    await user.keyboard("{Enter}");

    await waitFor(() => expect(state.input).toContain("[@Coder](profile:profile_coder)"));
  });

  test("@ searches past files on the server and inserts a file chip", async () => {
    const user = userEvent.setup();
    const { state } = renderComposer();

    await user.click(editor());
    await user.keyboard("Compare @rep");
    await screen.findByRole("option", { name: /report\.pdf/ });
    expect(attachmentQueries.at(-1)?.search).toBe("rep");
    await user.keyboard("{Enter}");

    await waitFor(() => expect(state.input).toContain("[@report.pdf](file:attachment_report)"));
  });

  test("an agent can find the composer and write into it", async () => {
    const { state } = renderComposer();
    const agent = createAgent();

    const names = agent.snapshot().map((entry) => entry.label);
    expect(names).toContain("Type your message here...");

    await act(() =>
      agent.act({ steps: [{ ref: "Type your message here...", action: "setValue", args: [["Hi agent"]] }] }),
    );
    await waitFor(() => expect(state.input).toBe("Hi agent"));
  });
});

describe("parseComposerInput", () => {
  test("drops profile tokens, keeps file labels in the text and collects ids", () => {
    const parsed = parseComposerInput(
      "[@Coder](profile:profile_coder) Compare [@report.pdf](file:a1) with [@report.pdf](file:a1) and [docs](https://x.dev)",
    );

    expect(parsed.text).toBe("Compare report.pdf with report.pdf and [docs](https://x.dev)");
    expect<string | null>(parsed.profileId).toBe("profile_coder");
    expect(parsed.profileLabel).toBe("Coder");
    expect<string[]>(parsed.attachmentIds).toEqual(["a1"]);
  });
});
