import type { Doc } from "@ai-chat/backend/convex/_generated/dataModel";
import { findAttachmentNames, splitMessageTokens } from "@ai-chat/shared/chat/message-content";

import { createContext, use, useMemo } from "react";
import { defaultComponents, defaultRehypePlugins, type Components, type StreamdownProps } from "streamdown";

import { fileChipClassName, FileChipContent, tokenChipClassName } from "../chat-textarea/token-chip";

import { StreamDownWrapper } from "./message-markdown";

import { FILE_TOKEN_TYPE } from "@/lib/chat/composer-tokens";
import type { ChatMessage } from "@/lib/types";

const TOKEN_HREF_PREFIX = "#message-token/";
// The markdown sanitizer prefixes in-page anchors with `user-content-`.
const SANITIZED_TOKEN_HREF_PREFIX = "#user-content-message-token/";
const USER_ROLE: ChatMessage["role"] = "user";

type MessageAttachments = ReadonlyArray<
  { _id: string } & Pick<Doc<"attachments">, "name" | "type" | "path" | "mimeType">
>;

const MessageAttachmentsContext = createContext<MessageAttachments>([]);

function escapeLinkText(text: string): string {
  return text.replaceAll(/[\\[\]*_`~<>]/g, "\\$&");
}

// Tokens become hash links so the markdown parser keeps them inline; the `a` renderer swaps them for chips.
function toMarkdownWithTokenLinks(text: string): string {
  return splitMessageTokens(text)
    .map((segment) => {
      if (segment.kind === "text") return segment.text;

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
  if (!type || !value || label === undefined) return null;

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
  const attachments = use(MessageAttachmentsContext);
  const token = parseTokenHref(props.href);

  if (!token) {
    return DefaultLink ? <DefaultLink {...props}>{children}</DefaultLink> : <a {...props}>{children}</a>;
  }

  if (token.type === FILE_TOKEN_TYPE) {
    const attachment = attachments.find((item) => item._id === token.value);
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

  return (
    <MessageAttachmentsContext value={attachments}>
      <StreamDownWrapper role={USER_ROLE} components={components} rehypePlugins={rehypePlugins}>
        {markdown}
      </StreamDownWrapper>
    </MessageAttachmentsContext>
  );
}
