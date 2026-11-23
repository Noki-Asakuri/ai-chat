import { afterAll, describe, expect, mock, setDefaultTimeout, test } from "bun:test";

setDefaultTimeout(20_000);

await import("@/test/dom");
const { render } = await import("@testing-library/react");

await mock.module("@/lib/assets/urls", () => ({
  buildAttachmentUrl: (path: string) => `https://files.test/${path}`,
  buildImageAssetUrl: (path: string) => `https://assets.test/${path}`,
  buildImageThumbnailUrl: (url: string) => url,
}));

const { MessageUserText } = await import("./message-user-text");

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

  test("leaves messages without tokens unchanged", () => {
    const { container } = renderText("Plain [link](https://x.dev) text");
    expect(container.querySelector('[data-slot="message-token"]')).toBeNull();
    expect(container.textContent).toContain("Plain link text");
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
