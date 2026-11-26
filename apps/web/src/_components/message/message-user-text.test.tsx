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

  test("typed chip-like text reads as the markdown it is, never as a chip", () => {
    const { container } = renderText("Explain \\[@home](file:example) here");

    expect(container.querySelector('[data-slot="message-token"]')).toBeNull();
    expect(container.textContent).toContain("Explain @home");
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

  test("an unclosed fence before typed chip-like text makes no chip or math", () => {
    const { container } = renderTyped(["Use ``` to open, and type [@note](a:b) here"]);

    expect(container.querySelector('[data-slot="message-token"], .katex')).toBeNull();
    expect(container.textContent).toContain("type @note");
  });

  test("typed chip-like text after a code block with a chip makes no chip", () => {
    const { container } = renderTyped([
      "```\n",
      { type: "file", value: "attachment_cat", label: "cat.webp" },
      "\n```\nsee [@foo](https://example.com)",
    ]);

    expect(codeTexts(container).join("")).toContain("cat.webp");
    expect(container.querySelector('[data-slot="message-token"]')).toBeNull();
    expect(container.textContent).toContain("see @foo");
  });

  test("typed chip-like text after a code line with backticks in it isn't math", () => {
    const { container } = renderTyped(["```\nfoo ``` bar\n```\n[@a](b:c)"]);

    expect(container.querySelector(".katex")).toBeNull();
    expect(container.textContent).toContain("@a");
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

  test("typed text shaped like a token link stays text, in code and out of it", () => {
    const { container } = renderTyped(["`[x](#message-token/name//foo)` and [y](#message-token/name//bar)"]);

    expect(codeTexts(container)).toEqual(["[x](#message-token/name//foo)"]);
    expect(container.querySelector('[data-slot="message-token"]')).toBeNull();
  });

  test("typed text that looks like a broken token link shows as is", () => {
    const { container } = renderTyped(["`[x](#message-token/a/%E0%A4/b)` and [y](#message-token/c/%E0/d)"]);

    expect(codeTexts(container)).toEqual(["[x](#message-token/a/%E0%A4/b)"]);
  });

  test("a chip right after a URL stays a chip", () => {
    const { container } = renderTyped([
      "See http://x.com/",
      { type: "name", value: "", label: "a.pdf" },
      " now",
    ]);

    expect(container.querySelector('[data-slot="message-token"][data-token-type="name"]')?.textContent).toBe(
      "a.pdf",
    );
    expect(container.textContent).not.toContain("message-token");
  });

  test("a typed comment opener before a chip stays visible", () => {
    const { container } = renderTyped([
      "Why does <!-- break my page?\nSee the file:",
      { type: "name", value: "", label: "a.pdf" },
      " please",
    ]);

    expect(container.textContent).toContain("break my page?");
    expect(container.querySelector('[data-slot="message-token"]')?.textContent).toBe("a.pdf");
  });

  test("a chip right after a word inside code shows as its name", () => {
    const { container } = renderTyped(["Run `cat", { type: "name", value: "", label: "a.pdf" }, "` now"]);

    expect(codeTexts(container)).toEqual(["cata.pdf"]);
  });

  test("a chip inside bold or math keeps the markdown around it", () => {
    const chip = { type: "name", value: "", label: "a.pdf" };
    const { container } = renderTyped(["See **", chip, "** and $x + ", chip, "$ ok"]);

    expect(
      container.querySelector('[data-streamdown="strong"] [data-slot="message-token"]')?.textContent,
    ).toBe("a.pdf");
    expect(container.querySelector(".katex")?.textContent).toContain("a.pdf");
  });

  test("typed HTML can't make a chip, and a URL before a chip ends where the chip starts", () => {
    const { container } = renderTyped([
      '<span data-message-chip="0">x</span> http://x.com/',
      { type: "name", value: "", label: "a.pdf" },
    ]);

    expect(container.querySelectorAll('[data-slot="message-token"]')).toHaveLength(1);
    const link = container.querySelector('[data-streamdown="link"]');
    expect(link?.textContent).toBe("http://x.com/");
  });

  test("a URL with no path, or a www link, right before a chip ends where the chip starts", () => {
    const chip = { type: "name", value: "", label: "a.pdf" };
    for (const url of ["https://x.com", "www.x.com"]) {
      const { container, unmount } = renderTyped(["see ", url, chip, ". now"]);
      const links = [...container.querySelectorAll('[data-streamdown="link"]')];

      expect(links.map((link) => link.textContent)).toEqual([url]);
      expect(container.querySelectorAll('[data-slot="message-token"]')).toHaveLength(1);
      expect(container.textContent).not.toContain("blocked");
      unmount();
    }
  });

  test("a chip in a link's address, an image's alt text or a link's text is its name", () => {
    const chip = { type: "name", value: "", label: "a.pdf" };
    const { container } = renderTyped([
      "[x](https://x.dev/",
      chip,
      ") ![",
      chip,
      "](https://x.dev/i.png) [see ",
      chip,
      "](https://x.dev)",
    ]);

    expect(container.innerHTML).not.toMatch(/[\u{F0000}-\u{FFFFD}]/u);
    expect(container.querySelector('[data-slot="message-token"]')).toBeNull();
    expect(container.textContent).toContain("see a.pdf");
  });

  test("a chip's name in math is typeset as text", () => {
    const { container } = renderTyped(["$x + ", { type: "name", value: "", label: "a_b%c.pdf" }, "$ ok"]);

    expect(container.querySelector(".katex-error")).toBeNull();
    expect(container.querySelector(".katex-html")?.textContent).toContain("a_b%c.pdf");
  });

  test("a chip in typed HTML code is its plain name, not TeX", () => {
    const { container } = renderTyped([
      "see <code>",
      { type: "name", value: "", label: "a.pdf" },
      "</code> ok",
    ]);

    expect(codeTexts(container)).toEqual(["a.pdf"]);
  });

  test("a bare URL cut at a chip leaves out the punctuation markdown would", () => {
    const chip = { type: "name", value: "", label: "a.pdf" };
    for (const [typed, url] of [
      ["see https://x.com.", "https://x.com"],
      ["(see https://x.com/a)", "https://x.com/a"],
    ] as const) {
      const { container, unmount } = renderTyped([typed, chip]);
      const links = [...container.querySelectorAll('[data-streamdown="link"]')];

      expect(links.map((link) => link.textContent)).toEqual([url]);
      expect(container.querySelector('[data-slot="message-token"]')?.textContent).toBe("a.pdf");
      unmount();
    }
  });

  test("a bare URL cut at a chip leaves out a closing bracket, as markdown does", () => {
    const { container } = renderTyped(["see https://x.com/a]", { type: "name", value: "", label: "a.pdf" }]);

    expect(container.querySelector('[data-streamdown="link"]')?.textContent).toBe("https://x.com/a");
  });

  test("a chip's name with quotes inside a typed HTML attribute stays inside it", () => {
    const { container } = renderTyped([
      'Pic <img src="https://x.dev/i.png" alt="',
      { type: "name", value: "", label: 'say "hi".pdf' },
      '"> end',
    ]);

    expect(container.querySelector("img")?.getAttribute("alt")).toBe('say "hi".pdf');
  });

  test("a link written in full keeps its chips as names, not split", () => {
    const chip = { type: "name", value: "", label: "a.pdf" };
    const { container } = renderTyped(["[a ", chip, "](https://e.com/", chip, ")"]);
    const links = [...container.querySelectorAll('[data-streamdown="link"]')];

    expect(links.map((link) => link.textContent)).toEqual(["a a.pdf"]);
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

  test("turns names inside a typed HTML block into chips too", () => {
    expect(chipsIn("Look:\n\n<p>see q3 report.pdf</p>")).toEqual(["q3 report.pdf"]);
  });

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
