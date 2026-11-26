import type { Doc } from "@ai-chat/backend/convex/_generated/dataModel";
import { findAttachmentNames, splitMessageTokens } from "@ai-chat/shared/chat/message-content";

import { createContext, use, useMemo } from "react";
import { defaultRehypePlugins, type Components, type StreamdownProps } from "streamdown";

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

type MdastNode = {
  type: string;
  value?: string;
  url?: string;
  title?: string | null;
  alt?: string | null;
  children?: MdastNode[];
};

const escapeHtml = (text: string): string =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

// A bare URL or email that ran into a chip, since markdown reads a placeholder like a letter, ends
// where the chip starts.
function splitAutolink(link: MdastNode): MdastNode[] {
  const [text] = link.children ?? [];
  if (link.children?.length !== 1 || text?.type !== "text" || !text.value || !link.url) return [link];

  const at = text.value.search(CHIP_PLACEHOLDER);
  const cut = at > 0 ? link.url.indexOf(String.fromCodePoint(text.value.codePointAt(at) ?? 0)) : -1;
  if (cut === -1) return [link];

  return [
    { ...link, url: link.url.slice(0, cut), children: [{ ...text, value: text.value.slice(0, at) }] },
    { type: "text", value: text.value.slice(at) },
  ];
}

/**
 * Works on the markdown tree, which is where code blocks take their code from. Where markdown keeps
 * text as is (code, raw HTML, a link's address or title, an image's alt text), a chip is its name. A
 * raw HTML block's chips are names too: its HTML is parsed later, past where chips can go in. And a
 * bare URL or email that ran into a chip, since markdown reads a placeholder like a letter, ends
 * where the chip starts.
 */
function createChipNamesPlugin(chips: ReadonlyArray<MessageChip>) {
  const toNames = (value: string, escape: (label: string) => string = (label) => label) =>
    value.replaceAll(CHIP_PLACEHOLDER, (placeholder) => {
      const index = chipAt(chips, placeholder);
      return index === undefined ? placeholder : escape(chips[index]?.label ?? "");
    });

  function visit(node: MdastNode): void {
    if (node.type === "code" || node.type === "inlineCode") node.value = toNames(node.value ?? "");
    if (node.type === "html") node.value = toNames(node.value ?? "", escapeHtml);
    if (node.url) node.url = toNames(node.url);
    if (node.title) node.title = toNames(node.title);
    if (node.alt) node.alt = toNames(node.alt);

    if (!node.children) return;
    node.children = node.children.flatMap((child) =>
      child.type === "link" ? splitAutolink(child) : [child],
    );
    node.children.forEach(visit);
  }

  return () => (tree: MdastNode) => visit(tree);
}

type HastText = { type: "text"; value: string };
type HastElement = {
  type: "element";
  tagName: string;
  properties: Record<string, boolean | number | string | Array<number | string> | null | undefined>;
  children: HastNode[];
};
type HastNode =
  HastText | HastElement | { type: "root" | "comment" | "doctype" | "raw"; children?: HastNode[] };
type RehypePlugin = NonNullable<StreamdownProps["rehypePlugins"]>[number];

// The element a chip renders from. It's added after sanitizing, so typed HTML can't make one.
function chipElement(index: number): HastElement {
  return { type: "element", tagName: "span", properties: { dataMessageChip: index }, children: [] };
}

// TeX's special characters, as `\\text{}` writes them literally.
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

/**
 * Puts each chip in where its placeholder is. Inside a link, which a chip can't sit in, and inside
 * math, which KaTeX typesets next, a chip is its name. Other code was handled on the markdown tree.
 */
function createChipPlugin(chips: ReadonlyArray<MessageChip>): RehypePlugin {
  function nameText(node: HastText, escape: (label: string) => string): HastText {
    const value = node.value.replaceAll(CHIP_PLACEHOLDER, (placeholder) => {
      const index = chipAt(chips, placeholder);
      return index === undefined ? placeholder : escape(chips[index]?.label ?? "");
    });
    return { ...node, value };
  }

  function splitText(node: HastText): HastNode[] {
    const nodes: HastNode[] = [];
    let lastIndex = 0;

    for (const match of node.value.matchAll(CHIP_PLACEHOLDER)) {
      const index = chipAt(chips, match[0]);
      if (index === undefined) continue;

      if (match.index > lastIndex) {
        nodes.push({ type: "text", value: node.value.slice(lastIndex, match.index) });
      }
      nodes.push(chipElement(index));
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex === 0) return [node];
    if (lastIndex < node.value.length) nodes.push({ type: "text", value: node.value.slice(lastIndex) });
    return nodes;
  }

  type Context = "text" | "link" | "math";

  function contextOf(node: HastNode, parent: Context): Context {
    if (parent !== "text" || node.type !== "element") return parent;
    if (node.tagName === "a") return "link";
    return node.tagName === "code" ? "math" : "text";
  }

  function visit(node: HastNode, context: Context): void {
    if (!("children" in node) || !node.children) return;
    const here = contextOf(node, context);

    node.children = node.children.flatMap((child) => {
      if (child.type !== "text") {
        visit(child, here);
        return [child];
      }
      if (here === "text") return splitText(child);
      return [nameText(child, here === "math" ? toTexText : (label) => label)];
    });
  }

  return () => (tree: HastNode) => visit(tree, "text");
}

const SKIPPED_TAGS = new Set(["a", "code", "pre"]);

// Messages sent before file chips were saved hold the attachment's name as plain text. Turn those
// names into chips, after markdown parsing so code spans and links stay untouched. Each attachment's
// chip is already in the message's chips, at `chipIndexById`.
function createAttachmentNamePlugin(
  attachments: MessageAttachments,
  chipIndexById: ReadonlyMap<string, number>,
): RehypePlugin | null {
  if (!attachments.some((attachment) => attachment.name.trim().length > 0)) return null;

  function splitText(node: HastText): HastNode[] {
    const nodes: HastNode[] = [];
    let lastIndex = 0;

    for (const match of findAttachmentNames(node.value, attachments)) {
      if (match.index > lastIndex) {
        nodes.push({ type: "text", value: node.value.slice(lastIndex, match.index) });
      }
      const index = chipIndexById.get(match.id);
      nodes.push(index === undefined ? { type: "text", value: match.name } : chipElement(index));
      lastIndex = match.index + match.name.length;
    }

    if (lastIndex === 0) return [node];
    if (lastIndex < node.value.length) nodes.push({ type: "text", value: node.value.slice(lastIndex) });
    return nodes;
  }

  function visit(node: HastNode): void {
    if (!("children" in node) || !node.children) return;
    if (node.type === "element" && SKIPPED_TAGS.has(node.tagName)) return;

    node.children = node.children.flatMap((child) => {
      if (child.type === "text") return splitText(child);
      visit(child);
      return [child];
    });
  }

  return () => (tree: HastNode) => visit(tree);
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
    const plugins: RehypePlugin[] = [...Object.values(defaultRehypePlugins), createChipPlugin(parsed.chips)];

    // Older messages without saved chips get one for each of their files' names in the text.
    if (parsed.chips.length === 0) {
      const chipIndexById = new Map<string, number>();
      for (const attachment of attachments) {
        chipIndexById.set(attachment._id, parsed.chips.length);
        parsed.chips.push({ type: FILE_TOKEN_TYPE, value: attachment._id, label: attachment.name });
      }
      const attachmentNames = createAttachmentNamePlugin(attachments, chipIndexById);
      if (attachmentNames) plugins.push(attachmentNames);
    }

    return { ...parsed, remarkPlugins: [createChipNamesPlugin(parsed.chips)], rehypePlugins: plugins };
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
