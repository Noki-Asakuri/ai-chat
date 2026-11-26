import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";
import type { TokenInputValueChangeReason } from "@ui-sdk/react/token-input";
import type { FunctionReference } from "convex/server";
import { afterAll, beforeEach, describe, expect, mock, setDefaultTimeout, spyOn, test } from "bun:test";

setDefaultTimeout(20_000);

await import("@/test/dom");
const { act, fireEvent, render, screen, waitFor } = await import("@testing-library/react");
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

type SyncCall = {
  threadId: string;
  model: string;
  modelParams: { effort?: string; webSearch?: boolean; profile?: string | null };
};
const syncCalls: SyncCall[] = [];
const actualRouter = await import("@tanstack/react-router");
await mock.module("@tanstack/react-router", () => ({
  ...actualRouter,
  useParams: () => ({ threadId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" }),
}));
await mock.module("@/lib/trpc/client", () => ({
  syncThreadModelConfig: async (input: SyncCall) => {
    syncCalls.push(input);
  },
}));

const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
const { createAgent } = await import("@ui-sdk/react/agent");
const { ConfigStoreContext } = await import("@/components/provider/config-provider");
const { createConfigStore } = await import("@/lib/store/config-store");
const { SelectableModelIds, tryGetModelData } = await import("@/lib/chat/models");
const {
  EDIT_COMPOSER_ID,
  FILE_TOKEN_TYPE,
  getComposerController,
  insertUploadChips,
  isChipDeletion,
  isPastFileReadableBy,
  linkAttachmentNames,
  withoutUploadChips,
  linkSentFileChips,
  MAIN_COMPOSER_ID,
  NAME_TOKEN_TYPE,
  parseComposerInput,
  rememberComposerAttachments,
  removeComposerChips,
} = await import("@/lib/chat/composer-tokens");
const { chatStoreActions, useChatStore } = await import("@/lib/store/chat-store");
const { getEditSentAttachments, isEditFileAttached } = await import("@/lib/chat/edit-attachments");
const { fromText, toText } = await import("@ui-sdk/react/token-input");
const { useState } = await import("react");
const { RichComposer } = await import("./rich-composer");
const { GlobalDropzone } = await import("../chat/global-dropzone");

afterAll(() => mock.restore());

const { getReasoningOptions } = await import("@/lib/chat/models");

const fileModel = SelectableModelIds.find((id) => {
  const data = tryGetModelData(id);
  return (
    data?.modalities.input.includes("pdf") &&
    data.capabilities.toolCalling &&
    getReasoningOptions(data).includes("high") &&
    getReasoningOptions(data).includes("low")
  );
});
if (!fileModel) throw new Error("Expected a model that accepts PDFs, web search and reasoning effort");

const modelLabel = (id: string) => {
  const data = tryGetModelData(id);
  return data ? (data.display.unique ?? data.display.name) : id;
};
// Typing a label that is part of another model's label would leave two matches.
const otherModel = SelectableModelIds.find(
  (id) =>
    id !== fileModel &&
    !SelectableModelIds.some((other) => other !== id && modelLabel(other).includes(modelLabel(id))),
);
if (!otherModel) throw new Error("Expected a second model");
const otherModelLabel = modelLabel(otherModel);

type Upload = { id: string; file: File; type: "image" | "pdf" };

function pdfUpload(id: string, name: string, bytes: number): Upload {
  return { id, file: new File(["x".repeat(bytes)], name, { type: "application/pdf" }), type: "pdf" };
}

function renderComposer(
  options: { pref?: "enter" | "ctrlEnter"; input?: string; uploads?: ReadonlyArray<Upload> } = {},
) {
  const store = createConfigStore({ model: fileModel, pref: options.pref ?? "enter" });
  const queryClient = new QueryClient();
  const state = { input: options.input ?? "" };
  const onConfirm = mock(() => {});
  const setInput = mock((next: string) => {
    state.input = next;
  });

  function view(input: string, uploads: ReadonlyArray<Upload> = options.uploads ?? []) {
    return (
      <QueryClientProvider client={queryClient}>
        <ConfigStoreContext.Provider value={store}>
          <RichComposer
            id="composer"
            input={input}
            setInput={setInput}
            model={fileModel!}
            uploads={uploads}
            handleAddAttachments={() => {}}
            onConfirm={onConfirm}
            enableCommands
          />
        </ConfigStoreContext.Provider>
      </QueryClientProvider>
    );
  }

  const result = render(view(state.input));
  const rerenderWith = (input: string, uploads?: ReadonlyArray<Upload>) =>
    result.rerender(view(input, uploads));
  return { ...result, store, state, onConfirm, setInput, rerenderWith };
}

function editor() {
  return screen.getByRole("textbox", { name: "Type your message here..." });
}

beforeEach(() => {
  attachmentQueries.length = 0;
  syncCalls.length = 0;
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
    await waitFor(() => expect(editor().getAttribute("aria-placeholder")).toContain("/ for commands"));

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
    expect(fileChips()[0]?.textContent).toContain("2 kB");
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

function fileChips() {
  return [...editor().querySelectorAll('[data-slot="token-input-token"]')].filter((chip) =>
    chip.className.includes("bg-muted"),
  );
}

describe("RichComposer added files", () => {
  const photo = pdfUpload("u1", "scan.pdf", 2048);

  test("shows a file in the tray as a chip with its size", () => {
    renderComposer({ input: "Read [@scan.pdf](upload:u1)", uploads: [photo] });

    expect(fileChips()).toHaveLength(1);
    expect(fileChips()[0]?.textContent).toContain("scan.pdf");
    expect(fileChips()[0]?.textContent).toContain("2 kB");
  });

  test("shows a chip whose file isn't in the tray as just its name", () => {
    const { rerenderWith } = renderComposer({ input: "Read [@scan.pdf](upload:u1)", uploads: [photo] });

    act(() => rerenderWith("Read [@scan.pdf](upload:u1)", []));

    expect(fileChips()).toHaveLength(0);
    expect(editor().textContent).toContain("scan.pdf");
    expect(editor().textContent).not.toContain("2 kB");
  });

  test("removing a chip keeps the caret in place and doesn't join the words around it", async () => {
    const { state } = renderComposer({
      input: "See[@a.pdf](upload:u1) now and [@a.pdf](upload:u1)",
      uploads: [photo],
    });
    const controller = getComposerController("composer");
    if (!controller) throw new Error("Expected the composer to register its controller");

    editor().focus();
    // Inserting nothing moves the caret; it goes after "See", the chip and " now" (offset 8).
    act(() => {
      controller.insert("", { at: { start: 8, end: 8 } });
    });
    expect(controller.editor.selection()).toEqual({ start: 8, end: 8 });

    act(() => removeComposerChips("composer", "upload", ["u1"]));
    await waitFor(() => expect(state.input).toBe("See now and"));
    expect(controller.editor.selection()).toEqual({ start: 7, end: 7 });
  });

  test("removing a chip before punctuation takes the space before it", async () => {
    const { state } = renderComposer({
      input: "Look at [@a.pdf](upload:u1), then [@a.pdf](upload:u1).",
      uploads: [photo],
    });

    act(() => removeComposerChips("composer", "upload", ["u1"]));
    await waitFor(() => expect(state.input).toBe("Look at, then."));
  });

  test("removing chips that leave no text puts the caret at the start", async () => {
    const { state } = renderComposer({
      input: " [@a.pdf](upload:u1) [@a.pdf](upload:u1)",
      uploads: [photo],
    });
    const controller = getComposerController("composer");
    if (!controller) throw new Error("Expected the composer to register its controller");

    editor().focus();
    act(() => {
      controller.insert("", { at: { start: 2, end: 2 } });
    });
    act(() => removeComposerChips("composer", "upload", ["u1"]));

    await waitFor(() => expect(state.input).toBe(""));
    expect(controller.editor.selection()).toEqual({ start: 0, end: 0 });
  });

  test("removing two chips side by side keeps the caret where it was", async () => {
    const { state } = renderComposer({
      input: "a [@a.pdf](upload:u1)[@a.pdf](upload:u1)\nb",
      uploads: [photo],
    });
    const controller = getComposerController("composer");
    if (!controller) throw new Error("Expected the composer to register its controller");

    editor().focus();
    act(() => {
      controller.insert("", { at: { start: 2, end: 2 } });
    });
    act(() => removeComposerChips("composer", "upload", ["u1"]));

    await waitFor(() => expect(state.input).toBe("a\nb"));
    expect(controller.editor.selection()).toEqual({ start: 1, end: 1 });
  });

  test("adds chips at the end and removes only the chips asked for", async () => {
    const { state } = renderComposer({ input: "Compare [@report.pdf](file:attachment_report)" });
    const second = pdfUpload("u2", "notes.pdf", 10);

    act(() => insertUploadChips("composer", [photo, second]));
    await waitFor(() =>
      expect(state.input).toBe(
        "Compare [@report.pdf](file:attachment_report) [@scan.pdf](upload:u1) [@notes.pdf](upload:u2) ",
      ),
    );

    act(() => removeComposerChips("composer", "upload", ["u1"]));
    await waitFor(() =>
      expect(state.input).toBe("Compare [@report.pdf](file:attachment_report) [@notes.pdf](upload:u2) "),
    );

    act(() => removeComposerChips("composer", FILE_TOKEN_TYPE, ["attachment_report"]));
    await waitFor(() => expect(state.input).toBe("Compare [@notes.pdf](upload:u2) "));
  });
});

function MainComposer() {
  const [queryClient] = useState(() => new QueryClient());
  const [store] = useState(() => createConfigStore({ model: fileModel, pref: "enter" }));
  const input = useChatStore((state) => state.input);
  const uploads = useChatStore((state) => state.attachments);

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigStoreContext.Provider value={store}>
        <RichComposer
          id={MAIN_COMPOSER_ID}
          input={input}
          setInput={chatStoreActions.setInput}
          model={fileModel!}
          uploads={uploads}
          handleAddAttachments={() => {}}
          onRemoveChips={chatStoreActions.removeChipAttachments}
        />
      </ConfigStoreContext.Provider>
    </QueryClientProvider>
  );
}

describe("chat store tray", () => {
  test("a file added right before a word is spaced from it", async () => {
    useChatStore.setState({ input: "Helloworld", attachments: [] });
    render(<MainComposer />);
    const controller = getComposerController(MAIN_COMPOSER_ID);
    if (!controller) throw new Error("Expected the composer to register its controller");

    editor().focus();
    controller.editor.selection = () => ({ start: 5, end: 5 });
    controller.editor.textBefore = () => ({ text: "o", offset: 4 });
    act(() => chatStoreActions.addAttachments([pdfUpload("u15", "g.pdf", 10)]));

    await waitFor(() => expect(useChatStore.getState().input).toBe("Hello [@g.pdf](upload:u15) world"));
  });

  test("a file added while text is selected goes after the selection and keeps the text", async () => {
    useChatStore.setState({ input: "Hello world", attachments: [] });
    render(<MainComposer />);
    const controller = getComposerController(MAIN_COMPOSER_ID);
    if (!controller) throw new Error("Expected the composer to register its controller");

    editor().focus();
    // The editor reports the selected range; selecting text in this DOM isn't reliable.
    controller.editor.selection = () => ({ start: 0, end: 5 });
    controller.editor.textBefore = () => ({ text: "o", offset: 4 });
    act(() => chatStoreActions.addAttachments([pdfUpload("u9", "f.pdf", 10)]));

    // Spaced from the word before it, so the model doesn't read "Hellof.pdf".
    await waitFor(() => expect(useChatStore.getState().input).toBe("Hello [@f.pdf](upload:u9) world"));
  });

  test("adding a file puts its chip in the composer and removing it takes the chip out", async () => {
    useChatStore.setState({ input: "Hello", attachments: [] });
    render(<MainComposer />);

    act(() => chatStoreActions.addAttachments([pdfUpload("u3", "plan.pdf", 4096)]));
    await waitFor(() => expect(useChatStore.getState().input).toBe("Hello [@plan.pdf](upload:u3) "));
    await waitFor(() => expect(fileChips()[0]?.textContent).toContain("4 kB"));

    act(() => chatStoreActions.removeAttachment("u3"));
    await waitFor(() => expect(useChatStore.getState().input).toBe("Hello "));
    expect(useChatStore.getState().attachments).toHaveLength(0);
  });

  test("a chip's remove button takes its file out of the tray", async () => {
    const user = userEvent.setup();
    useChatStore.setState({ input: "", attachments: [] });
    render(<MainComposer />);

    act(() => chatStoreActions.addAttachments([pdfUpload("u4", "a.pdf", 10), pdfUpload("u5", "b.pdf", 10)]));
    await waitFor(() => expect(fileChips()).toHaveLength(2));

    const remove = fileChips()[0]?.querySelector('[data-slot="token-input-token-remove"]');
    if (!remove) throw new Error("Expected a remove button on the chip");
    await user.click(remove);

    await waitFor(() => expect(useChatStore.getState().attachments.map((item) => item.id)).toEqual(["u5"]));
    expect(useChatStore.getState().input).not.toContain("upload:u4");
  });

  test("removing one of two chips of a file keeps the file and the other chip", async () => {
    const user = userEvent.setup();
    const upload = pdfUpload("u10", "scan.pdf", 10);
    useChatStore.setState({
      input: "[@scan.pdf](upload:u10) and [@scan.pdf](upload:u10) ",
      attachments: [upload],
    });
    render(<MainComposer />);
    await waitFor(() => expect(fileChips()).toHaveLength(2));

    const remove = fileChips()[0]?.querySelector('[data-slot="token-input-token-remove"]');
    if (!remove) throw new Error("Expected a remove button on the chip");
    await user.click(remove);

    await waitFor(() => expect(fileChips()).toHaveLength(1));
    await act(async () => {});
    expect(useChatStore.getState().attachments.map((item) => item.id)).toEqual(["u10"]);
    expect(useChatStore.getState().input).toContain("upload:u10");
  });

  test("clearing text that holds one chip keeps its file, while a word delete on the chip alone removes it", async () => {
    useChatStore.setState({ input: "Summarize this ", attachments: [] });
    render(<MainComposer />);
    act(() => chatStoreActions.addAttachments([pdfUpload("w1", "w.pdf", 10)]));
    await waitFor(() => expect(fileChips()).toHaveLength(1));
    const deleteKey = (inputType: string) =>
      act(() => {
        editor().dispatchEvent(new InputEvent("beforeinput", { inputType, bubbles: true, cancelable: true }));
      });

    editor().focus();
    document.getSelection()?.selectAllChildren(editor());
    deleteKey("deleteContentBackward");
    await waitFor(() => expect(useChatStore.getState().input).toBe(""));
    await act(async () => {});
    expect(useChatStore.getState().attachments.map((item) => item.id)).toEqual(["w1"]);

    useChatStore.setState({ input: "", attachments: [] });
    act(() => chatStoreActions.addAttachments([pdfUpload("w2", "x.pdf", 10)]));
    await waitFor(() => expect(fileChips()).toHaveLength(1));
    editor().focus();
    act(() => {
      getComposerController(MAIN_COMPOSER_ID)?.insert("", { at: { start: 1, end: 1 } });
    });
    deleteKey("deleteWordBackward");
    await waitFor(() => expect(fileChips()).toHaveLength(0));
    await waitFor(() => expect(useChatStore.getState().attachments).toHaveLength(0));
  });

  test("two chips of one image share a single preview URL, revoked when both are gone", async () => {
    const created: string[] = [];
    const revoked: string[] = [];
    const createSpy = spyOn(URL, "createObjectURL").mockImplementation(() => {
      created.push(`blob:${created.length}`);
      return created.at(-1) ?? "";
    });
    const revokeSpy = spyOn(URL, "revokeObjectURL").mockImplementation((url: string) => {
      revoked.push(url);
    });

    try {
      const image = { ...pdfUpload("img1", "p.png", 10), type: "image" as const };
      useChatStore.setState({ input: "[@p.png](upload:img1) [@p.png](upload:img1) ", attachments: [image] });
      const { unmount } = render(<MainComposer />);
      await waitFor(() => expect(fileChips()).toHaveLength(2));
      const chipUrls = new Set(created);

      unmount();
      expect(created).toHaveLength(1);
      expect(revoked.filter((url) => chipUrls.has(url))).toEqual([...chipUrls]);
    } finally {
      createSpy.mockRestore();
      revokeSpy.mockRestore();
      useChatStore.setState({ input: "", attachments: [] });
    }
  });

  test("undoing a removal brings the name back without the file", async () => {
    useChatStore.setState({ input: "", attachments: [] });
    render(<MainComposer />);

    act(() => chatStoreActions.addAttachments([pdfUpload("u6", "c.pdf", 10)]));
    await waitFor(() => expect(fileChips()).toHaveLength(1));
    act(() => chatStoreActions.removeAttachment("u6"));
    await waitFor(() => expect(fileChips()).toHaveLength(0));

    act(() => {
      getComposerController(MAIN_COMPOSER_ID)?.undo();
    });
    await waitFor(() => expect(useChatStore.getState().input).toContain("upload:u6"));
    await act(async () => {});
    expect(fileChips()).toHaveLength(0);
    expect(editor().textContent).toContain("c.pdf");
    expect(useChatStore.getState().attachments).toHaveLength(0);
  });

  test("a chip cut, pasted, and pasted again after undoing the paste keeps its file", async () => {
    useChatStore.setState({ input: "", attachments: [] });
    render(<MainComposer />);
    act(() => chatStoreActions.addAttachments([pdfUpload("u13", "k.pdf", 10)]));
    await waitFor(() => expect(fileChips()).toHaveLength(1));
    const controller = getComposerController(MAIN_COMPOSER_ID);
    if (!controller) throw new Error("Expected the composer to register its controller");
    const chip = { type: "upload", value: "u13", label: "k.pdf" };

    // Each step is its own event, so the work a change queues runs before the next one.
    const step = async (change: () => void) => {
      await act(async () => {
        change();
      });
    };
    await step(() => controller.setValue([" "], { reason: "cut" }));
    await step(() => controller.setValue([chip, " "], { reason: "paste" }));
    await step(() => controller.undo());
    await step(() => controller.setValue([chip, " "], { reason: "paste" }));

    await waitFor(() => expect(fileChips()).toHaveLength(1));
    await act(async () => {});
    expect(useChatStore.getState().attachments.map((item) => item.id)).toEqual(["u13"]);
  });

  test("undoing and redoing typing over a chip keeps its file", async () => {
    useChatStore.setState({ input: "", attachments: [] });
    render(<MainComposer />);
    act(() => chatStoreActions.addAttachments([pdfUpload("u14", "m.pdf", 10)]));
    await waitFor(() => expect(fileChips()).toHaveLength(1));
    const controller = getComposerController(MAIN_COMPOSER_ID);
    if (!controller) throw new Error("Expected the composer to register its controller");

    // Each step is its own event, so the work a change queues runs before the next one.
    await act(async () => {
      controller.setValue(["typed over"], { reason: "input-change" });
    });
    await act(async () => {
      controller.undo();
    });
    await act(async () => {
      controller.redo();
    });
    expect(useChatStore.getState().attachments.map((item) => item.id)).toEqual(["u14"]);
  });

  test("switching to a model that can't read one of several files, with no words typed, takes out its chip", async () => {
    const imageOnlyModel = SelectableModelIds.find((id) => {
      const inputs = tryGetModelData(id)?.modalities.input ?? [];
      return inputs.includes("image") && !inputs.includes("pdf");
    });
    if (!imageOnlyModel) throw new Error("Expected a model that reads images but not PDFs");
    const image = { ...pdfUpload("i1", "photo.png", 10), type: "image" as const };

    useChatStore.setState({ input: "", attachments: [] });
    render(<MainComposer />);
    act(() => chatStoreActions.addAttachments([image, pdfUpload("p1", "report.pdf", 10)]));
    await waitFor(() => expect(useChatStore.getState().attachments).toHaveLength(2));

    act(() => chatStoreActions.retainCompatibleAttachments(imageOnlyModel));
    await waitFor(() => expect(useChatStore.getState().input).toBe("[@photo.png](upload:i1) "));
  });

  test("switching to a model that can't read a file empties the composer when the file was all it had", async () => {
    const textOnlyModel = SelectableModelIds.find(
      (id) => !tryGetModelData(id)?.modalities.input.includes("pdf"),
    );
    if (!textOnlyModel) throw new Error("Expected a model that can't read PDFs");

    useChatStore.setState({ input: "", attachments: [] });
    render(<MainComposer />);
    act(() => chatStoreActions.addAttachments([pdfUpload("u16", "only.pdf", 10)]));
    await waitFor(() => expect(fileChips()).toHaveLength(1));

    act(() => chatStoreActions.retainCompatibleAttachments(textOnlyModel));
    await waitFor(() => expect(useChatStore.getState().input).toBe(""));
  });

  test("switching to a model that can't read a file keeps its name in the sentence, and undo doesn't bring the file back", async () => {
    const textOnlyModel = SelectableModelIds.find(
      (id) => !tryGetModelData(id)?.modalities.input.includes("pdf"),
    );
    if (!textOnlyModel) throw new Error("Expected a model that can't read PDFs");

    useChatStore.setState({ input: "Compare ", attachments: [] });
    render(<MainComposer />);
    act(() => chatStoreActions.addAttachments([pdfUpload("u11", "g.pdf", 10)]));
    await waitFor(() => expect(fileChips()).toHaveLength(1));
    act(() => {
      getComposerController(MAIN_COMPOSER_ID)?.insert("please", { at: "end" });
    });

    act(() => chatStoreActions.retainCompatibleAttachments(textOnlyModel));
    await waitFor(() => expect(useChatStore.getState().input).toBe("Compare [@g.pdf](name:) please"));
    expect(useChatStore.getState().attachments).toHaveLength(0);
    expect(editor().textContent).toContain("g.pdf");

    act(() => {
      getComposerController(MAIN_COMPOSER_ID)?.undo();
    });
    await waitFor(() => expect(useChatStore.getState().input).toContain("upload:u11"));
    await act(async () => {});
    expect(fileChips()).toHaveLength(0);
    expect(useChatStore.getState().attachments).toHaveLength(0);
  });
});

function fakeId<TableName extends "messages" | "attachments" | "threads">(value: string): Id<TableName> {
  // SAFETY: The store only compares these ids, so plain strings can stand in for documents.
  // eslint-disable-next-line typescript/no-unsafe-type-assertion
  return value as Id<TableName>;
}

function EditComposer() {
  const [queryClient] = useState(() => new QueryClient());
  const [store] = useState(() => createConfigStore({ model: fileModel, pref: "enter" }));
  const editMessage = useChatStore((state) => state.editMessage);
  if (!editMessage) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigStoreContext.Provider value={store}>
        <RichComposer
          id={EDIT_COMPOSER_ID}
          input={editMessage.input}
          setInput={(input) => chatStoreActions.updateEditMessage({ input })}
          model={editMessage.model}
          uploads={editMessage.attachments}
          onRemoveChips={chatStoreActions.removeEditChipAttachments}
          isFileAttached={(attachmentId) => isEditFileAttached(editMessage, attachmentId)}
          handleAddAttachments={() => {}}
        />
      </ConfigStoreContext.Provider>
    </QueryClientProvider>
  );
}

describe("edit tray", () => {
  test("switching the edit's model takes out its own files and added files in one undo step", async () => {
    const textOnlyModel = SelectableModelIds.find(
      (id) => !tryGetModelData(id)?.modalities.input.includes("pdf"),
    );
    if (!textOnlyModel) throw new Error("Expected a model that can't read PDFs");
    const ownFile = {
      _id: fakeId<"attachments">("own_pdf_2"),
      _creationTime: 1,
      id: "own2",
      name: "own.pdf",
      size: 2048,
      type: "pdf" as const,
      source: "user" as const,
      mimeType: "application/pdf",
      path: "u/t/own2.pdf",
      userId: "u",
      threadId: fakeId<"threads">("thread_1"),
    };
    chatStoreActions.setEditMessage({
      _id: fakeId<"messages">("message_4"),
      input: "Compare [@own.pdf](file:own_pdf_2) with [@new.pdf](upload:u17) please",
      model: fileModel,
      currentAttachments: [ownFile],
      keptAttachmentIds: [ownFile._id],
      attachments: [pdfUpload("u17", "new.pdf", 10)],
      modelParams: {},
    });
    render(<EditComposer />);
    await waitFor(() => expect(fileChips()).toHaveLength(2));

    act(() => chatStoreActions.retainCompatibleEditAttachments(textOnlyModel));
    await waitFor(() =>
      expect(useChatStore.getState().editMessage?.input).toBe(
        "Compare [@own.pdf](name:) with [@new.pdf](name:) please",
      ),
    );

    act(() => {
      getComposerController(EDIT_COMPOSER_ID)?.undo();
    });
    await waitFor(() =>
      expect(useChatStore.getState().editMessage?.input).toBe(
        "Compare [@own.pdf](file:own_pdf_2) with [@new.pdf](upload:u17) please",
      ),
    );
    chatStoreActions.setEditMessage(null);
  });

  test("a file removed from the tray stays out after undo, on screen and when saved", async () => {
    const ownFile = {
      _id: fakeId<"attachments">("own_pdf"),
      _creationTime: 1,
      id: "own",
      name: "own.pdf",
      size: 2048,
      type: "pdf" as const,
      source: "user" as const,
      mimeType: "application/pdf",
      path: "u/t/own.pdf",
      userId: "u",
      threadId: fakeId<"threads">("thread_1"),
    };
    chatStoreActions.setEditMessage({
      _id: fakeId<"messages">("message_2"),
      input: "Look at [@own.pdf](file:own_pdf)",
      model: fileModel,
      currentAttachments: [ownFile],
      keptAttachmentIds: [ownFile._id],
      attachments: [],
      modelParams: {},
    });
    render(<EditComposer />);
    await waitFor(() => expect(fileChips()).toHaveLength(1));

    act(() => chatStoreActions.removeEditExistingAttachment(ownFile._id));
    await waitFor(() => expect(useChatStore.getState().editMessage?.input).toBe("Look at"));

    act(() => {
      getComposerController(EDIT_COMPOSER_ID)?.undo();
    });
    await waitFor(() => expect(useChatStore.getState().editMessage?.input).toContain("file:own_pdf"));
    await act(async () => {});
    expect(fileChips()).toHaveLength(0);
    expect(editor().textContent).toContain("own.pdf");

    const edit = useChatStore.getState().editMessage!;
    expect(getEditSentAttachments(edit, [ownFile], [])).toEqual([]);
    expect(linkSentFileChips(edit.input, new Map(), [])).toBe("Look at [@own.pdf](name:)");
    chatStoreActions.setEditMessage(null);
  });

  test("removing one of two chips of a kept file in the edit box keeps the file", async () => {
    const user = userEvent.setup();
    chatStoreActions.setEditMessage({
      _id: fakeId<"messages">("message_3"),
      input: "[@own.pdf](file:own_pdf) and [@own.pdf](file:own_pdf)",
      model: fileModel,
      currentAttachments: [],
      keptAttachmentIds: [fakeId<"attachments">("own_pdf")],
      attachments: [],
      modelParams: {},
    });
    render(<EditComposer />);
    await waitFor(() => expect(editor().querySelectorAll('[data-slot="token-input-token"]')).toHaveLength(2));

    const remove = editor().querySelector('[data-slot="token-input-token-remove"]');
    if (!remove) throw new Error("Expected a remove button on the chip");
    await user.click(remove);

    await waitFor(() => expect(editor().querySelectorAll('[data-slot="token-input-token"]')).toHaveLength(1));
    await act(async () => {});
    expect<string[] | undefined>(useChatStore.getState().editMessage?.keptAttachmentIds).toEqual(["own_pdf"]);
    chatStoreActions.setEditMessage(null);
  });

  test("removing chips from the edit box takes their files out of its tray", () => {
    chatStoreActions.setEditMessage({
      _id: fakeId<"messages">("message_1"),
      input: "",
      model: fileModel,
      currentAttachments: [],
      keptAttachmentIds: [fakeId<"attachments">("kept_1"), fakeId<"attachments">("kept_2")],
      attachments: [pdfUpload("u7", "d.pdf", 10), pdfUpload("u8", "e.pdf", 10)],
      modelParams: {},
    });

    chatStoreActions.removeEditChipAttachments([
      { type: "upload", value: "u7", label: "d.pdf" },
      { type: FILE_TOKEN_TYPE, value: "kept_1", label: "f.pdf" },
      { type: FILE_TOKEN_TYPE, value: "elsewhere", label: "g.pdf" },
    ]);

    const edit = useChatStore.getState().editMessage;
    expect(edit?.attachments.map((item) => item.id)).toEqual(["u8"]);
    expect<string[] | undefined>(edit?.keptAttachmentIds).toEqual(["kept_2"]);
    chatStoreActions.setEditMessage(null);
  });
});

function DropTargets() {
  const [store] = useState(() => createConfigStore({ model: fileModel, pref: "enter" }));
  return (
    <ConfigStoreContext.Provider value={store}>
      <GlobalDropzone>
        <div data-slot="chat-textarea" data-testid="main-composer">
          <div id={MAIN_COMPOSER_ID} />
        </div>
        <div data-slot="chat-textarea" data-testid="edit-composer">
          <div id={EDIT_COMPOSER_ID} />
        </div>
      </GlobalDropzone>
    </ConfigStoreContext.Provider>
  );
}

describe("dropping files while a message is being edited", () => {
  test("a file dropped on the main composer goes to its tray, anywhere else to the edit's", () => {
    useChatStore.setState({ input: "", attachments: [] });
    chatStoreActions.setEditMessage({
      _id: fakeId<"messages">("message_3"),
      input: "",
      model: fileModel,
      currentAttachments: [],
      keptAttachmentIds: [],
      attachments: [],
      modelParams: {},
    });
    render(<DropTargets />);

    fireEvent.drop(screen.getByTestId("main-composer"), {
      dataTransfer: { files: [pdfUpload("d", "drop.pdf", 1).file] },
    });
    expect(useChatStore.getState().attachments).toHaveLength(1);
    expect(useChatStore.getState().editMessage?.attachments).toHaveLength(0);

    fireEvent.drop(screen.getByTestId("edit-composer"), {
      dataTransfer: { files: [pdfUpload("d", "drop.pdf", 1).file] },
    });
    expect(useChatStore.getState().attachments).toHaveLength(1);
    expect(useChatStore.getState().editMessage?.attachments).toHaveLength(1);
    chatStoreActions.setEditMessage(null);
  });
});

describe("isPastFileReadableBy", () => {
  test("a past file the model can't read isn't attached, and one not looked up yet is", () => {
    const textOnlyModel = SelectableModelIds.find(
      (id) => !tryGetModelData(id)?.modalities.input.includes("pdf"),
    );
    if (!textOnlyModel || !fileModel) throw new Error("Expected models with and without PDF input");
    rememberComposerAttachments([
      {
        _id: fakeId<"attachments">("past_pdf"),
        _creationTime: 1,
        id: "past",
        name: "past.pdf",
        size: 10,
        type: "pdf",
        source: "user",
        mimeType: "application/pdf",
        path: "u/t/past.pdf",
        threadId: fakeId<"threads">("thread_1"),
        userId: "u",
      },
    ]);

    expect(isPastFileReadableBy(fileModel, "past_pdf")).toBe(true);
    expect(isPastFileReadableBy(textOnlyModel, "past_pdf")).toBe(false);
    expect(isPastFileReadableBy(textOnlyModel, "never_seen")).toBe(true);
  });
});

describe("isChipDeletion", () => {
  const chip = { type: "upload", value: "u1", label: "a.pdf" };
  const deletion = (
    reason: TokenInputValueChangeReason,
    inputType?: string,
    { removed = [chip], removedLength = 1 } = {},
  ) => isChipDeletion({ reason, inputType, removed }, removedLength);

  test("counts the remove button, and a delete key taking out just that chip", () => {
    expect(deletion("remove-press")).toBe(true);
    expect(deletion("input-change", "deleteContentBackward")).toBe(true);
    expect(deletion("input-change", "deleteContentForward")).toBe(true);
    expect(deletion("input-change", "deleteWordBackward")).toBe(true);
  });

  test("leaves out clearing a chip along with text, or several chips at once", () => {
    const other = { type: "upload", value: "u2", label: "b.pdf" };
    expect(deletion("input-change", "deleteContentBackward", { removedLength: 17 })).toBe(false);
    expect(
      deletion("input-change", "deleteContentBackward", { removed: [chip, other], removedLength: 2 }),
    ).toBe(false);
  });

  test("leaves out cutting, dragging, typing over, undo, redo and changes that remove no chip", () => {
    expect(deletion("cut")).toBe(false);
    expect(deletion("input-change", "deleteByCut")).toBe(false);
    expect(deletion("input-change", "deleteByDrag")).toBe(false);
    expect(deletion("input-change", "insertText")).toBe(false);
    expect(deletion("remove-press", undefined, { removed: [] })).toBe(false);
    expect(deletion("undo")).toBe(false);
    expect(deletion("redo")).toBe(false);
  });
});

describe("linkSentFileChips", () => {
  test("keeps an unsent file's chip-like name whole, as a name chip", () => {
    const text = toText(["See \\", { type: "upload", value: "u1", label: "[@draft](file:example).pdf" }]);
    const linked = linkSentFileChips(text, new Map(), []);

    expect(fromText(linked)).toMatchObject([
      "See \\",
      { type: NAME_TOKEN_TYPE, value: "", label: "[@draft](file:example).pdf" },
    ]);
  });

  test("points sent files' chips at their saved attachments and turns the rest into names", () => {
    const text = "[@a.pdf](upload:u1) [@b.pdf](upload:u2) [@c.pdf](file:saved) [@d.pdf](file:dropped)";

    expect(linkSentFileChips(text, new Map([["u1", "att1"]]), ["att1", "saved"])).toBe(
      "[@a.pdf](file:att1) [@b.pdf](name:) [@c.pdf](file:saved) [@d.pdf](name:)",
    );
  });

  test("leaves profile chips and plain text alone", () => {
    const text = "[@Coder](profile:p1) Look at [docs](https://x.dev)";
    expect(linkSentFileChips(text, new Map(), [])).toBe(text);
  });
});

describe("RichComposer commands", () => {
  test("/ lists commands and profiles in named groups", async () => {
    const user = userEvent.setup();
    renderComposer();
    await waitFor(() => expect(editor().getAttribute("aria-placeholder")).toContain("/ for commands"));

    await user.click(editor());
    await user.keyboard("/");

    const commands = await screen.findByRole("group", { name: "Commands" });
    expect(commands.textContent).toContain("/model");
    expect(commands.textContent).toContain("/effort");
    expect(commands.textContent).toContain("/search");
    expect((await screen.findByRole("group", { name: "Profiles" })).textContent).toContain("Coder");
  });

  test("/model switches the model and leaves nothing in the message", async () => {
    const user = userEvent.setup();
    const { store, state } = renderComposer();

    await user.click(editor());
    await user.keyboard("/model");
    await screen.findByRole("option", { name: /\/model/ });
    await user.keyboard("{Enter}");
    await user.keyboard(otherModelLabel);
    await screen.findByRole("option", { name: otherModelLabel });
    await user.keyboard("{Enter}");

    await waitFor(() => expect(store.getState().model).toBe(otherModel));
    expect(syncCalls.at(-1)?.model).toBe(otherModel);
    expect(state.input.trim()).toBe("");
  });

  test("/effort sets the reasoning effort", async () => {
    const user = userEvent.setup();
    const { store } = renderComposer();
    act(() => store.getState().setModelParams({ effort: "low" }));

    await user.click(editor());
    await user.keyboard("/effort");
    await screen.findByRole("option", { name: /\/effort/ });
    await user.keyboard("{Enter}");
    await user.keyboard("High");
    await screen.findByRole("option", { name: "High" });
    await user.keyboard("{Enter}");

    await waitFor(() => expect(store.getState().modelParams.effort).toBe("high"));
    expect(syncCalls.at(-1)?.modelParams.effort).toBe("high");
  });

  test("/search toggles web search", async () => {
    const user = userEvent.setup();
    const { store, state } = renderComposer();
    expect(store.getState().modelParams.webSearch).toBe(false);

    await user.click(editor());
    await user.keyboard("/search");
    await screen.findByRole("option", { name: /\/search/ });
    await user.keyboard("{Enter}");

    await waitFor(() => expect(store.getState().modelParams.webSearch).toBe(true));
    expect(syncCalls.at(-1)?.modelParams.webSearch).toBe(true);
    expect(state.input.trim()).toBe("");
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

describe("withoutUploadChips", () => {
  test("turns a restored draft's chips of added files into name chips, and leaves the rest", () => {
    expect(withoutUploadChips("See [@a.pdf](upload:u1) and [@b.pdf](file:att1)")).toBe(
      "See [@a.pdf](name:) and [@b.pdf](file:att1)",
    );
    expect(withoutUploadChips("Plain \\[@x](upload:y)")).toBe("Plain \\[@x](upload:y)");
  });

  test("a draft restored from storage keeps its added files' names but not their chips", async () => {
    localStorage.setItem(
      "local-chat-store",
      JSON.stringify({ state: { input: "See [@a.pdf](upload:u1)" }, version: 0 }),
    );
    await useChatStore.persist.rehydrate();

    expect(useChatStore.getState().input).toBe("See [@a.pdf](name:)");
    localStorage.removeItem("local-chat-store");
    useChatStore.setState({ input: "", attachments: [] });
  });
});

describe("linkAttachmentNames", () => {
  const files = [
    { _id: "a1", name: "538a24bd-51d8-4882-bf21-d5976192d080.webp" },
    { _id: "a2", name: "q3 report.pdf" },
  ];

  test("turns an older message's file names into chips for the edit box", () => {
    expect(linkAttachmentNames("538a24bd-51d8-4882-bf21-d5976192d080.webp what is this image", files)).toBe(
      "[@538a24bd-51d8-4882-bf21-d5976192d080.webp](file:a1) what is this image",
    );
    expect(linkAttachmentNames("Summarize q3 report.pdf.", files)).toBe(
      "Summarize [@q3 report.pdf](file:a2).",
    );
  });

  test("leaves code, links, longer names and saved chips alone", () => {
    const text = "Run `cat q3 report.pdf` or see [q3 report.pdf](https://x.dev) and old-q3 report.pdf";
    expect(linkAttachmentNames(text, files)).toBe(text);

    const fenced = "```\nq3 report.pdf\n```";
    expect(linkAttachmentNames(fenced, files)).toBe(fenced);

    const saved = "Compare [@q3 report.pdf](file:a2) with q3 report.pdf";
    expect(linkAttachmentNames(saved, files)).toBe(saved);
  });

  test("gives back typed chip-like text as it was saved, not as a chip", () => {
    for (const typed of ["see [@foo](file:x) here", "use [@media] queries", "path\\[@x"]) {
      const saved = toText([typed]);
      const editable = linkAttachmentNames(saved, files);

      expect(editable).toBe(saved);
      expect(fromText(editable)).toEqual([typed]);
    }
  });

  test("links an older message's file names next to typed chip-like text", () => {
    const saved = toText(["see [@foo](file:x) and q3 report.pdf"]);

    expect(fromText(linkAttachmentNames(saved, files))).toMatchObject([
      "see [@foo](file:x) and ",
      { type: FILE_TOKEN_TYPE, value: "a2", label: "q3 report.pdf" },
    ]);
  });

  test("round-trips through the parser used when saving", () => {
    const parsed = parseComposerInput(linkAttachmentNames("Look at q3 report.pdf please", files));
    expect(parsed.text).toBe("Look at q3 report.pdf please");
    expect<string[]>(parsed.attachmentIds).toEqual(["a2"]);
  });
});
