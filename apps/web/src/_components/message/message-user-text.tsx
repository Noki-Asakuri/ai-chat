import type { Doc } from "@ai-chat/backend/convex/_generated/dataModel";
import { findAttachmentNames, splitMessageTokens } from "@ai-chat/shared/chat/message-content";

import { createContext, use, useMemo } from "react";
import { defaultComponents, defaultRehypePlugins, type Components, type StreamdownProps } from "streamdown";

import { fileChipClassName, FileChipContent, tokenChipClassName } from "../chat-textarea/token-chip";
import { ImageLightboxProvider, ImageLightboxTrigger, type LightboxImage } from "../image-lightbox";

import { StreamDownWrapper } from "./message-markdown";

import { buildAttachmentUrl, toRawFileUrl } from "@/lib/assets/urls";
import { FILE_TOKEN_TYPE, NAME_TOKEN_TYPE } from "@/lib/chat/composer-tokens";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

const TOKEN_HREF_PREFIX = "#message-token/";
// The markdown sanitizer prefixes in-page anchors with `user-content-`.
const SANITIZED_TOKEN_HREF_PREFIX = "#user-content-message-token/";
const USER_ROLE: ChatMessage["role"] = "user";

type MessageAttachments = ReadonlyArray<
  { _id: string } & Pick<Doc<"attachments">, "name" | "type" | "path" | "mimeType">
>;

type MessageAttachmentsContextValue = {
  attachments: MessageAttachments;
  // Lightbox index of each image attachment, by attachment id.
  imageIndexById: ReadonlyMap<string, number>;
};

const MessageAttachmentsContext = createContext<MessageAttachmentsContextValue>({
  attachments: [],
  imageIndexById: new Map(),
});

const imageChipClassName = cn(
  fileChipClassName,
  "cursor-zoom-in hover:bg-accent hover:ring-foreground/25 focus-visible:ring-2 focus-visible:ring-ring",
);

function escapeLinkText(text: string): string {
  return text.replaceAll(/[\\[\]*_`~<>]/g, "\\$&");
}

// The codec escapes typed chip-like text as `\[@`, after its own backslashes doubled. Markdown reads
// that escape the same way, but the LaTeX fix reads `\[` as display math, so the bracket goes in as an
// entity. Only the run's start is checked behind, so long backslash runs stay fast.
const ESCAPED_CHIP_OPENER = /(?<!\\)((?:\\\\)*)\\\[@/g;

// Tokens become hash links so the markdown parser keeps them inline; the `a` renderer swaps them for chips.
function toMarkdownWithTokenLinks(text: string): string {
  return splitMessageTokens(text)
    .map((segment) => {
      if (segment.kind === "text") return segment.text.replaceAll(ESCAPED_CHIP_OPENER, "$1&#91;@");

      return `[${escapeLinkText(segment.label)}](${toTokenHref(segment.type, segment.value, segment.label)})`;
    })
    .join("");
}

function toTokenHref(type: string, value: string, label: string): string {
  return `${TOKEN_HREF_PREFIX}${[type, value, label].map(encodeURIComponent).join("/")}`;
}

function parseTokenHref(href: string | undefined) {
  let path: string | undefined;
  if (href?.startsWith(TOKEN_HREF_PREFIX)) path = href.slice(TOKEN_HREF_PREFIX.length);
  if (href?.startsWith(SANITIZED_TOKEN_HREF_PREFIX)) path = href.slice(SANITIZED_TOKEN_HREF_PREFIX.length);
  if (path === undefined) return null;

  const [type, value, label] = path.split("/").map(decodeURIComponent);
  // A name chip has no value.
  if (!type || value === undefined || label === undefined) return null;

  return { type, value, label };
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

const SKIPPED_TAGS = new Set(["a", "code", "pre"]);

// Messages sent before file chips were saved hold the attachment's name as plain text. Turn those
// names into the same token links, after markdown parsing so code spans and links stay untouched.
function createAttachmentNamePlugin(attachments: MessageAttachments): RehypePlugin | null {
  if (!attachments.some((attachment) => attachment.name.trim().length > 0)) return null;

  function splitText(node: HastText): HastNode[] {
    const nodes: HastNode[] = [];
    let lastIndex = 0;

    for (const match of findAttachmentNames(node.value, attachments)) {
      if (match.index > lastIndex) {
        nodes.push({ type: "text", value: node.value.slice(lastIndex, match.index) });
      }
      nodes.push({
        type: "element",
        tagName: "a",
        properties: { href: toTokenHref(FILE_TOKEN_TYPE, match.id, match.name) },
        children: [{ type: "text", value: match.name }],
      });
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

const DefaultLink = defaultComponents.a;

const MessageLink: NonNullable<Components["a"]> = function MessageLink({ children, ...props }) {
  const { attachments, imageIndexById } = use(MessageAttachmentsContext);
  const token = parseTokenHref(props.href);

  if (!token) {
    return DefaultLink ? <DefaultLink {...props}>{children}</DefaultLink> : <a {...props}>{children}</a>;
  }

  // The name of a file that wasn't sent reads as plain text, taken as is rather than as markdown.
  if (token.type === NAME_TOKEN_TYPE) {
    return (
      <span data-slot="message-token" data-token-type={token.type}>
        {token.label}
      </span>
    );
  }

  if (token.type === FILE_TOKEN_TYPE) {
    const attachment = attachments.find((item) => item._id === token.value);
    const imageIndex = imageIndexById.get(token.value);

    if (imageIndex !== undefined) {
      return (
        <ImageLightboxTrigger
          index={imageIndex}
          data-slot="message-token"
          data-token-type={token.type}
          title={token.label}
          aria-label={`View ${token.label}`}
          className={imageChipClassName}
        >
          <FileChipContent label={token.label} attachment={attachment} />
        </ImageLightboxTrigger>
      );
    }

    return (
      <span
        data-slot="message-token"
        data-token-type={token.type}
        title={token.label}
        className={fileChipClassName}
      >
        <FileChipContent label={token.label} attachment={attachment} />
      </span>
    );
  }

  return (
    <span data-slot="message-token" data-token-type={token.type} className={tokenChipClassName}>
      {token.label}
    </span>
  );
};

const components: Components = { a: MessageLink };

export function MessageUserText({ text, attachments }: { text: string; attachments: MessageAttachments }) {
  const markdown = useMemo(() => toMarkdownWithTokenLinks(text), [text]);

  const rehypePlugins = useMemo(() => {
    const hasSavedTokens = splitMessageTokens(text).some((segment) => segment.kind === "token");
    const attachmentNames = hasSavedTokens ? null : createAttachmentNamePlugin(attachments);
    return attachmentNames ? [...Object.values(defaultRehypePlugins), attachmentNames] : undefined;
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
    return { images: list, context: { attachments, imageIndexById } };
  }, [attachments]);

  const content = (
    <MessageAttachmentsContext value={context}>
      <StreamDownWrapper role={USER_ROLE} components={components} rehypePlugins={rehypePlugins}>
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
