import { beforeEach, describe, expect, test } from "bun:test";

await import("@/test/dom");
const { act, fireEvent, render, screen, waitFor } = await import("@testing-library/react");
const { useChatStore } = await import("@/lib/store/chat-store");
const { keepComposerFocus } = await import("./keep-composer-focus");
const { useComposerExpanded } = await import("./use-composer-expanded");

function Harness() {
  const { ref, expanded, onFocusCapture, onBlurCapture } = useComposerExpanded();

  return (
    <>
      <div
        ref={ref}
        data-testid="composer"
        data-expanded={expanded}
        onFocusCapture={onFocusCapture}
        onBlurCapture={onBlurCapture}
      >
        <textarea data-composer="main" aria-label="Message" />
        <button type="button" onMouseDown={keepComposerFocus}>
          Send
        </button>
        <input type="file" aria-label="Attach" />
      </div>
      <button type="button">Outside</button>
    </>
  );
}

function setup() {
  render(<Harness />);
  return {
    composer: screen.getByTestId("composer"),
    editor: screen.getByLabelText("Message"),
    fileInput: screen.getByLabelText("Attach"),
    outside: screen.getByRole("button", { name: "Outside" }),
  };
}

function focusOutside(editor: HTMLElement, outside: HTMLElement) {
  act(() => {
    outside.focus();
  });
  // happy-dom doesn't always send blur when focus moves; the hook only listens for it.
  fireEvent.blur(editor, { relatedTarget: outside });
}

beforeEach(() => {
  useChatStore.setState({ input: "", attachments: [] });
});

describe("useComposerExpanded", () => {
  test("a composer button doesn't take focus from the editor", () => {
    setup();
    // fireEvent returns false when the default action (moving focus) was prevented.
    expect(fireEvent.mouseDown(screen.getByRole("button", { name: "Send" }))).toBe(false);
  });

  test("expands on focus and collapses when focus leaves while empty", async () => {
    const { composer, editor, outside } = setup();
    expect(composer.dataset.expanded).toBe("false");

    act(() => editor.focus());
    expect(composer.dataset.expanded).toBe("true");

    focusOutside(editor, outside);
    await waitFor(() => expect(composer.dataset.expanded).toBe("false"));
  });

  test("keeps its layout while a file picker is open and refocuses the editor when it's cancelled", async () => {
    const { composer, editor, fileInput, outside } = setup();
    act(() => editor.focus());

    fireEvent.click(fileInput);
    // The picker takes focus from the page.
    focusOutside(editor, outside);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(composer.dataset.expanded).toBe("true");

    fireEvent(fileInput, new Event("cancel"));
    await waitFor(() => expect(document.activeElement).toBe(editor));
    expect(composer.dataset.expanded).toBe("true");
  });

  test("picking a file from the collapsed row expands without focusing the editor", async () => {
    const { composer, editor, fileInput } = setup();

    fireEvent.click(fileInput);
    act(() => {
      useChatStore.setState({
        attachments: [{ id: "a1", type: "image", file: new File(["x"], "a.png", { type: "image/png" }) }],
      });
    });
    fireEvent.change(fileInput);

    await waitFor(() => expect(composer.dataset.expanded).toBe("true"));
    expect(document.activeElement).not.toBe(editor);
  });

  test("cancelling a picker opened from the collapsed row leaves it collapsed", async () => {
    const { composer, editor, fileInput } = setup();

    fireEvent.click(fileInput);
    fireEvent(fileInput, new Event("cancel"));
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(composer.dataset.expanded).toBe("false");
    expect(document.activeElement).not.toBe(editor);
  });
});
