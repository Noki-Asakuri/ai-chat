import type { Doc } from "@ai-chat/backend/convex/_generated/dataModel";
import { findAttachmentNames, splitMessageTokens } from "@ai-chat/shared/chat/message-content";

import type { Element, Root as HastRoot, Text as HastText } from "hast";
import type { Link, Root as MdastRoot, Text as MdastText } from "mdast";
import { createContext, use, useMemo } from "react";
import { defaultRehypePlugins, type Components, type StreamdownProps } from "streamdown";
import { CONTINUE, SKIP, visit } from "unist-util-visit";

import { fileChipClassName, FileChipContent, tokenChipClassName } from "../chat-textarea/token-chip";
import { ImageLightboxProvider, ImageLightboxTrigger, type LightboxImage } from "../image-lightbox";

import { StreamDownWrapper } from "./message-markdown";

import { buildAttachmentUrl, toRawFileUrl } from "@/lib/assets/urls";
import { FILE_TOKEN_TYPE, NAME_TOKEN_TYPE } from "@/lib/chat/composer-tokens";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

const USER_ROLE: ChatMessage["role"] = "user";

type MessageAttachments = ReadonlyArray<
  { _id: string } & Pick<Doc<"attachments">, "name" | "type" | "path" | "mimeType">
>;

type MessageChip = { type: string; value: string; label: string };

type MessageAttachmentsContextValue = {
  attachments: MessageAttachments;
  // Lightbox index of each image attachment, by attachment id.
  imageIndexById: ReadonlyMap<string, number>;
  // The message's chips, by the index their elements carry.
  chips: ReadonlyArray<MessageChip>;
};

const MessageAttachmentsContext = createContext<MessageAttachmentsContextValue>({
  attachments: [],
  imageIndexById: new Map(),
  chips: [],
});

const imageChipClassName = cn(
  fileChipClassName,
  "cursor-zoom-in hover:bg-accent hover:ring-foreground/25 focus-visible:ring-2 focus-visible:ring-ring",
);

// Where a chip goes in the markdown: a character from the supplementary private-use area, one per
// chip by index, which people don't type. Markdown reads it like a letter, so it doesn't break
// emphasis or a word around it.
const FIRST_CHIP_CODE_POINT = 0xf0000;
const CHIP_PLACEHOLDER = /[\u{F0000}-\u{FFFFD}]/gu;

/**
 * A message's text as the markdown it was typed as, with a placeholder where each chip goes, and
 * its chips. Markdown then reads the text like any other, and the chip plugins put the chips in.
 */
type MarkdownWithChips = { markdown: string; chips: MessageChip[] };

function toMarkdownWithChips(text: string): MarkdownWithChips {
  const chips: MessageChip[] = [];
  const markdown = splitMessageTokens(text)
    .map((segment) => {
      if (segment.kind === "text") return segment.text;

      chips.push({ type: segment.type, value: segment.value, label: segment.label });
      return String.fromCodePoint(FIRST_CHIP_CODE_POINT + chips.length - 1);
    })
    .join("");

  return { markdown, chips };
}

function chipAt(chips: ReadonlyArray<MessageChip>, placeholder: string): number | undefined {
  const index = (placeholder.codePointAt(0) ?? 0) - FIRST_CHIP_CODE_POINT;
  return chips[index] ? index : undefined;
}

const placeholderFor = (index: number): string => String.fromCodePoint(FIRST_CHIP_CODE_POINT + index);

/** The text with each chip's placeholder replaced by its name, written by `write`. */
function withChipNames(
  text: string,
  chips: ReadonlyArray<MessageChip>,
  write: (label: string) => string = (label) => label,
): string {
  return text.replaceAll(CHIP_PLACEHOLDER, (placeholder) => {
    const index = chipAt(chips, placeholder);
    return index === undefined ? placeholder : write(chips[index]?.label ?? "");
  });
}

const escapeHtml = (text: string): string =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

// TeX's special characters, as `\text{}` writes them literally.
const TEX_TEXT_ESCAPES = new Map(
  Object.entries({
    "\\": "\\textbackslash{}",
    "{": "\\{",
    "}": "\\}",
    $: "\\$",
    "&": "\\&",
    "#": "\\#",
    "%": "\\%",
    _: "\\_",
    "^": "\\textasciicircum{}",
    "~": "\\textasciitilde{}",
  }),
);
const toTexText = (label: string): string =>
  `\\text{${label.replaceAll(/[\\{}$&#%_^~]/g, (char) => TEX_TEXT_ESCAPES.get(char) ?? char)}}`;

// What GFM leaves out of the end of a bare URL, and the closing paren it leaves out when unmatched.
const URL_TRAIL = /[.,:;!?"'*_~\]]$/;

/**
 * A bare URL or email that ran into a chip, since markdown reads a placeholder like a letter. It
 * ends where the chip starts, less the punctuation markdown would have left out of its end. Links
 * written in full, whose text isn't their address, are left alone.
 */
function splitAutolink(link: Link): Array<Link | MdastText> {
  const [text] = link.children;
  if (link.children.length !== 1 || text?.type !== "text") return [link];

  const shown = link.url.replace(/^mailto:/, "");
  if (text.value !== shown && `http://${text.value}` !== link.url) return [link];

  let end = text.value.search(CHIP_PLACEHOLDER);
  if (end <= 0) return [link];

  const head = () => text.value.slice(0, end);
  while (end > 0) {
    const unmatchedParen = head().endsWith(")") && head().split(")").length > head().split("(").length;
    if (!URL_TRAIL.test(head()) && !unmatchedParen) break;
    end -= 1;
  }
  if (end === 0) return [link];

  const cut = text.value.length - end;
  return [
    { ...link, url: link.url.slice(0, link.url.length - cut), children: [{ ...text, value: head() }] },
    { type: "text", value: text.value.slice(end) },
  ];
}

/**
 * The markdown tree's part, which is where code blocks take their code from. Where markdown keeps text
 * as is (code, raw HTML, a link's address or title, an image's alt text), a chip is its name. A raw
 * HTML block's chips are names too: its HTML is parsed later, past where chips can go in. A bare URL
 * that ran into a chip ends where the chip starts.
 */
function createChipNamesPlugin(chips: ReadonlyArray<MessageChip>) {
  return () => (tree: MdastRoot) => {
    visit(tree, (node, index, parent) => {
      if (node.type === "link" && parent && index !== undefined) {
        const parts = splitAutolink(node);
        if (parts.length > 1) parent.children.splice(index, 1, ...parts);
      }
      if (node.type === "code" || node.type === "inlineCode") node.value = withChipNames(node.value, chips);
      if (node.type === "html") node.value = withChipNames(node.value, chips, escapeHtml);
      if (node.type === "link" || node.type === "image" || node.type === "definition") {
        node.url = withChipNames(node.url, chips);
        if (node.title) node.title = withChipNames(node.title, chips);
      }
      if (node.type === "image" && node.alt) node.alt = withChipNames(node.alt, chips);
    });
  };
}

type LegacyChip = { attachment: { _id: string; name: string }; index: number };

function withLegacyPlaceholders(text: string, legacyChips: ReadonlyArray<LegacyChip>): string {
  const attachments = legacyChips.map((chip) => chip.attachment);
  const indexById = new Map(legacyChips.map((chip) => [chip.attachment._id, chip.index]));
  let result = "";
  let lastIndex = 0;

  for (const match of findAttachmentNames(text, attachments)) {
    const index = indexById.get(match.id);
    if (index === undefined) continue;
    result += text.slice(lastIndex, match.index) + placeholderFor(index);
    lastIndex = match.index + match.name.length;
  }

  return result + text.slice(lastIndex);
}

type RehypePlugin = NonNullable<StreamdownProps["rehypePlugins"]>[number];

// The element a chip renders from. It's added after sanitizing, so typed HTML can't make one.
function chipElement(index: number): Element {
  return { type: "element", tagName: "span", properties: { dataMessageChip: index }, children: [] };
}

function isMath(element: Element): boolean {
  const className = element.properties.className;
  return (
    Array.isArray(className) &&
    className.some((name) => name === "language-math" || String(name).startsWith("math-"))
  );
}

/**
 * The HTML tree's part, after sanitizing: each placeholder left becomes its chip. Inside a link,
 * which a chip can't sit in, and other code, a chip is its name; inside math, which KaTeX typesets
 * next, its name is TeX text. In a message saved before chips, its files' names outside links and
 * code become their chips too, typed HTML's text included.
 */
function createChipPlugin(
  chips: ReadonlyArray<MessageChip>,
  legacyChips: ReadonlyArray<LegacyChip>,
): RehypePlugin {
  return () => (tree: HastRoot) => {
    visit(tree, (node, index, parent) => {
      if (node.type === "element" && (node.tagName === "a" || node.tagName === "code")) {
        const write = node.tagName === "code" && isMath(node) ? toTexText : undefined;
        visit(node, "text", (text) => {
          text.value = withChipNames(text.value, chips, write);
        });
        return SKIP;
      }
      if (node.type !== "text" || !parent || index === undefined) return CONTINUE;

      const value = legacyChips.length > 0 ? withLegacyPlaceholders(node.value, legacyChips) : node.value;
      const parts = splitByChips(value, chips);
      if (parts.length === 1 && parts[0]?.type === "text") return CONTINUE;
      parent.children.splice(index, 1, ...parts);
      return index + parts.length;
    });
  };
}

function splitByChips(text: string, chips: ReadonlyArray<MessageChip>): Array<HastText | Element> {
  const parts: Array<HastText | Element> = [];
  let lastIndex = 0;

  for (const match of text.matchAll(CHIP_PLACEHOLDER)) {
    const index = chipAt(chips, match[0]);
    if (index === undefined) continue;
    if (match.index > lastIndex) parts.push({ type: "text", value: text.slice(lastIndex, match.index) });
    parts.push(chipElement(index));
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) parts.push({ type: "text", value: text.slice(lastIndex) });
  return parts;
}

function ChipView({ chip }: { chip: MessageChip }) {
  const { attachments, imageIndexById } = use(MessageAttachmentsContext);

  // The name of a file that wasn't sent reads as plain text.
  if (chip.type === NAME_TOKEN_TYPE) {
    return (
      <span data-slot="message-token" data-token-type={chip.type}>
        {chip.label}
      </span>
    );
  }

  if (chip.type === FILE_TOKEN_TYPE) {
    const attachment = attachments.find((item) => item._id === chip.value);
    const imageIndex = imageIndexById.get(chip.value);

    if (imageIndex !== undefined) {
      return (
        <ImageLightboxTrigger
          index={imageIndex}
          data-slot="message-token"
          data-token-type={chip.type}
          title={chip.label}
          aria-label={`View ${chip.label}`}
          className={imageChipClassName}
        >
          <FileChipContent label={chip.label} attachment={attachment} />
        </ImageLightboxTrigger>
      );
    }

    return (
      <span
        data-slot="message-token"
        data-token-type={chip.type}
        title={chip.label}
        className={fileChipClassName}
      >
        <FileChipContent label={chip.label} attachment={attachment} />
      </span>
    );
  }

  return (
    <span data-slot="message-token" data-token-type={chip.type} className={tokenChipClassName}>
      {chip.label}
    </span>
  );
}

const MessageSpan: NonNullable<Components["span"]> = function MessageSpan(props) {
  const { chips } = use(MessageAttachmentsContext);
  const { node, ...rest } = props;
  const index = Number(node?.properties?.dataMessageChip);
  const chip = Number.isInteger(index) ? chips[index] : undefined;

  return chip ? <ChipView chip={chip} /> : <span {...rest} />;
};

const components: Components = { span: MessageSpan };

export function MessageUserText({ text, attachments }: { text: string; attachments: MessageAttachments }) {
  const { markdown, chips, remarkPlugins, rehypePlugins } = useMemo(() => {
    const parsed = toMarkdownWithChips(text);

    // Older messages without saved chips get one for each of their files' names in the text.
    const legacyChips: LegacyChip[] = [];
    if (parsed.chips.length === 0) {
      for (const attachment of attachments) {
        if (!attachment.name.trim()) continue;
        legacyChips.push({ attachment, index: parsed.chips.length });
        parsed.chips.push({ type: FILE_TOKEN_TYPE, value: attachment._id, label: attachment.name });
      }
    }

    return {
      ...parsed,
      remarkPlugins: [createChipNamesPlugin(parsed.chips)],
      rehypePlugins: [...Object.values(defaultRehypePlugins), createChipPlugin(parsed.chips, legacyChips)],
    };
  }, [text, attachments]);

  const { images, context } = useMemo(() => {
    const list: LightboxImage[] = [];
    const imageIndexById = new Map<string, number>();
    for (const attachment of attachments) {
      if (attachment.type !== "image") continue;
      const src = toRawFileUrl(buildAttachmentUrl(attachment.path, attachment.mimeType));
      imageIndexById.set(attachment._id, list.length);
      list.push({
        id: attachment._id,
        src,
        downloadSrc: src,
        alt: attachment.name,
        name: attachment.name,
      });
    }
    return { images: list, context: { attachments, imageIndexById, chips } };
  }, [attachments, chips]);

  const content = (
    <MessageAttachmentsContext value={context}>
      <StreamDownWrapper
        role={USER_ROLE}
        components={components}
        extraRemarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
      >
        {markdown}
      </StreamDownWrapper>
    </MessageAttachmentsContext>
  );

  return images.length > 0 ? (
    <ImageLightboxProvider images={images}>{content}</ImageLightboxProvider>
  ) : (
    content
  );
}
