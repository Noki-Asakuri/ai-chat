import { afterAll, describe, expect, mock, setDefaultTimeout, test } from "bun:test";

setDefaultTimeout(20_000);

await import("@/test/dom");
const { render } = await import("@testing-library/react");

await mock.module("@/lib/assets/urls", () => ({
  buildAttachmentUrl: (path: string) => `https://files.test/${path}`,
  buildImageAssetUrl: (path: string) => `https://assets.test/${path}`,
  buildImageThumbnailUrl: (url: string) => url,
  toRawFileUrl: (url: string) => url,
}));

const { MessageUserText } = await import("./message-user-text");
const { ConfigStoreContext } = await import("@/components/provider/config-provider");
const { createConfigStore } = await import("@/lib/store/config-store");
const { toText } = await import("@ui-sdk/react/token-input");

afterAll(() => mock.restore());

const attachments = [
  {
    _id: "attachment_cat",
    name: "cat.webp",
    type: "image" as const,
    path: "u/t/a1.webp",
    mimeType: "image/webp",
  },
];

function renderText(text: string) {
  return render(<MessageUserText text={text} attachments={attachments} />);
}

describe("MessageUserText", () => {
  test("shows file tokens as chips inline with the text", () => {
    const { container } = renderText("What is [@cat\\_1.webp](file:attachment_cat) doing?");
    const chip = container.querySelector('[data-slot="message-token"][data-token-type="file"]');

    expect(chip?.textContent).toBe("cat_1.webp");
    expect(chip?.querySelector("img")?.getAttribute("src")).toBe("https://files.test/u/t/a1.webp");
    expect(chip?.closest("p")?.textContent).toBe("What is cat_1.webp doing?");
    expect(container.textContent).not.toContain("file:");
  });

  test("keeps markdown and ordinary links working around chips", () => {
    const { container } = renderText(
      "**Look** at [@cat.webp](file:attachment_cat) and [the docs](https://x.dev)",
    );

    expect(container.querySelector('[data-streamdown="strong"]')?.textContent).toBe("Look");
    expect(container.querySelector('[data-slot="message-token"]')).not.toBeNull();
    expect(container.querySelector('[data-streamdown="link"]')?.textContent).toBe("the docs");
    expect(container.querySelectorAll('[data-slot="message-token"]').length).toBe(1);
  });

  test("opens image chips in the lightbox", () => {
    const { container } = renderText("Who is [@cat.webp](file:attachment_cat)?");
    const chip = container.querySelector('[data-slot="message-token"]');

    expect(chip?.tagName).toBe("BUTTON");
    expect(chip?.getAttribute("aria-label")).toBe("View cat.webp");
  });

  test("falls back to a file icon when the attachment is gone", () => {
    const { container } = renderText("See [@old.pdf](file:missing)");
    const chip = container.querySelector('[data-slot="message-token"]');

    expect(chip?.textContent).toBe("old.pdf");
    expect(chip?.querySelector("svg")).not.toBeNull();
  });

  test("keeps labels with slashes, spaces and percent signs intact", () => {
    const { container } = renderText("Open [@q3/final 100%.pdf](file:attachment_cat)");
    expect(container.querySelector('[data-slot="message-token"]')?.textContent).toBe("q3/final 100%.pdf");
  });

  test("shows the name of a file that wasn't sent as it is, not as markdown", () => {
    const { container } = renderText("See [@__init__.py](name:) and [@*notes*.md](name:)");
    const names = container.querySelectorAll('[data-slot="message-token"][data-token-type="name"]');

    expect([...names].map((name) => name.textContent)).toEqual(["__init__.py", "*notes*.md"]);
    expect(container.querySelector("strong, em")).toBeNull();
    expect(container.textContent).toBe("See __init__.py and *notes*.md");
  });

  test("shows file names with brackets, parentheses and dollars whole, with the text after them", () => {
    const { container } = renderText(
      "Compare [@photo \\[1\\].jpg](file:attachment_cat), [@a).pdf](name:) and [@$2 \\[x\\] (y).pdf](name:) please",
    );
    const chips = container.querySelectorAll('[data-slot="message-token"]');

    expect([...chips].map((chip) => chip.textContent)).toEqual(["photo [1].jpg", "a).pdf", "$2 [x] (y).pdf"]);
    expect(container.textContent).toBe("Compare photo [1].jpg, a).pdf and $2 [x] (y).pdf please");
  });

  test("shows typed chip-like text inside code as typed", () => {
    // Code blocks read the config store.
    const store = createConfigStore({});
    const { container } = render(
      <ConfigStoreContext.Provider value={store}>
        <MessageUserText
          text={"Use `\\[@foo` here\n\n```\nNSArray *a = \\[@\\[@1, @2] mutableCopy];\n```"}
          attachments={attachments}
        />
      </ConfigStoreContext.Provider>,
    );

    expect(container.querySelector("code")?.textContent).toBe("[@foo");
    expect(container.textContent).toContain("NSArray *a = [@[@1, @2] mutableCopy];");
    expect(container.textContent).not.toContain("&#91;");
  });

  test("shows text the composer escaped as typed, not as a chip", () => {
    const { container } = renderText("Explain \\[@home](file:example)");

    expect(container.querySelector('[data-slot="message-token"]')).toBeNull();
    expect(container.textContent).toBe("Explain [@home](file:example)");
    expect(renderText("Path a\\\\\\[@b").container.textContent).toContain("Path a\\[@b");
  });

  test("leaves messages without tokens unchanged", () => {
    const { container } = renderText("Plain [link](https://x.dev) text");
    expect(container.querySelector('[data-slot="message-token"]')).toBeNull();
    expect(container.textContent).toContain("Plain link text");
  });
});

function codeTexts(container: HTMLElement) {
  return [...container.querySelectorAll("code")].map((code) => code.textContent);
}

describe("MessageUserText with code and typed chip-like text", () => {
  // Code blocks read the config store.
  const store = createConfigStore({});
  // What the composer saves for this value, so the escaping is exactly the codec's.
  function renderTyped(value: Parameters<typeof toText>[0]) {
    return render(
      <ConfigStoreContext.Provider value={store}>
        <MessageUserText text={toText(value)} attachments={attachments} />
      </ConfigStoreContext.Provider>,
    );
  }

  test("an unclosed fence before typed chip-like text doesn't turn it into a link or math", () => {
    const { container } = renderTyped(["Use ``` to open, and type [@note](a:b) here"]);

    expect(container.querySelector('[data-streamdown="link"], a')).toBeNull();
    expect(container.textContent).toContain("type [@note](a:b) here");
  });

  test("typed chip-like text after a code block with a chip stays text", () => {
    const { container } = renderTyped([
      "```\n",
      { type: "file", value: "attachment_cat", label: "cat.webp" },
      "\n```\nsee [@foo](https://example.com)",
    ]);

    // Only the bare URL is a link, as markdown makes any; `[@foo]` stays text.
    const links = [...container.querySelectorAll('[data-streamdown="link"]')];
    expect(links.map((link) => link.textContent)).toEqual(["https://example.com"]);
    expect(container.textContent).toContain("see [@foo](https://example.com)");
  });

  test("typed chip-like text after a code line with backticks in it isn't math", () => {
    const { container } = renderTyped(["```\nfoo ``` bar\n```\n[@a](b:c)"]);

    expect(container.querySelector(".katex")).toBeNull();
    expect(container.textContent).toContain("[@a](b:c)");
  });

  test("every kind of code shows typed chip-like text as typed", () => {
    for (const value of [
      "``[@a](b:c)``",
      "`[@a](b:c)\nnext`",
      "~~~\n[@a](b:c)\n~~~",
      "    [@a](b:c)",
      "````\n[@a](b:c)\n````",
      "`a\\[@b`",
    ]) {
      const { container, unmount } = renderTyped([value]);
      const shown = codeTexts(container).join("");

      expect(shown).not.toContain("&#91;");
      expect(shown.includes("[@a](b:c)") || shown.includes("a\\[@b")).toBe(true);
      expect(shown).not.toContain("\\[@a");
      unmount();
    }
  });

  test("chips inside code keep the typed brackets around them", () => {
    const a = { type: "name", value: "", label: "a.csv" };
    const b = { type: "name", value: "", label: "b.csv" };
    const { container } = renderTyped(['`files = ["', a, '", "', b, '"]`\n\n```\nload([', a, "])\n```"]);
    const shown = codeTexts(container);

    expect(shown[0]).toBe('files = ["a.csv", "b.csv"]');
    expect(shown.join("")).toContain("load([a.csv])");
  });

  test("typed text that looks like a broken token link shows as is", () => {
    const { container } = renderTyped(["`[x](#message-token/a/%E0%A4/b)` and [y](#message-token/c/%E0/d)"]);

    expect(codeTexts(container)).toEqual(["[x](#message-token/a/%E0%A4/b)"]);
  });

  test("a typed backslash before a closing bracket doesn't turn the rest of the message into math", () => {
    const { container } = renderTyped(["Mention [@user\\] here.\n\nNext paragraph **bold**."]);

    expect(container.querySelector(".katex")).toBeNull();
    expect(container.querySelector('[data-streamdown="strong"]')?.textContent).toBe("bold");
  });

  test("a chip inside a code span shows as its name", () => {
    const { container } = renderTyped(["Use `", { type: "name", value: "", label: "my (1).txt" }, "` now"]);

    expect(codeTexts(container)).toEqual(["my (1).txt"]);
  });
});

describe("MessageUserText for messages sent before file chips", () => {
  const legacy = [
    {
      _id: "attachment_legacy",
      name: "538a24bd-51d8-4882-bf21-d5976192d080.webp",
      type: "image" as const,
      path: "u/t/legacy.webp",
      mimeType: "image/webp",
    },
    {
      _id: "attachment_report",
      name: "q3 report.pdf",
      type: "pdf" as const,
      path: "u/t/r.pdf",
      mimeType: "application/pdf",
    },
  ];

  function chipsIn(text: string) {
    const { container } = render(<MessageUserText text={text} attachments={legacy} />);
    return [...container.querySelectorAll('[data-slot="message-token"]')].map((chip) => chip.textContent);
  }

  test("turns attachment names in plain text into chips", () => {
    const text = "538a24bd-51d8-4882-bf21-d5976192d080.webp what is this image";
    const { container } = render(<MessageUserText text={text} attachments={legacy} />);
    const chip = container.querySelector('[data-slot="message-token"]');

    expect(chip?.textContent).toBe("538a24bd-51d8-4882-bf21-d5976192d080.webp");
    expect(chip?.querySelector("img")?.getAttribute("src")).toBe("https://files.test/u/t/legacy.webp");
    expect(container.querySelector("p")?.textContent).toBe(text);
  });

  test("matches names with spaces and a sentence's closing period", () => {
    expect(chipsIn("Summarize q3 report.pdf.")).toEqual(["q3 report.pdf"]);
  });

  test("leaves names inside code, links and longer file names alone", () => {
    expect(chipsIn("Run `cat q3 report.pdf` on old-q3 report.pdf or q3 report.pdf.bak")).toEqual([]);
    expect(chipsIn("[q3 report.pdf](https://x.dev)")).toEqual([]);
  });

  test("does nothing extra once a message has saved chips", () => {
    expect(chipsIn("Compare [@q3 report.pdf](file:attachment_report) with q3 report.pdf")).toEqual([
      "q3 report.pdf",
    ]);
  });
});
