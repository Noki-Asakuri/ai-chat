import type { Doc } from "@ai-chat/backend/convex/_generated/dataModel";
import { splitMessageTokens } from "@ai-chat/shared/chat/message-content";

import { createContext, use, useMemo } from "react";
import { defaultComponents, type Components } from "streamdown";

import { fileChipClassName, FileChipContent, tokenChipClassName } from "../chat-textarea/token-chip";

import { StreamDownWrapper } from "./message-markdown";

import { FILE_TOKEN_TYPE } from "@/lib/chat/composer-tokens";
import type { ChatMessage } from "@/lib/types";

const TOKEN_HREF_PREFIX = "#message-token/";
// The markdown sanitizer prefixes in-page anchors with `user-content-`.
const SANITIZED_TOKEN_HREF_PREFIX = "#user-content-message-token/";
const USER_ROLE: ChatMessage["role"] = "user";

type MessageAttachments = ReadonlyArray<
  { _id: string } & Pick<Doc<"attachments">, "type" | "path" | "mimeType">
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

      const path = [segment.type, segment.value, segment.label].map(encodeURIComponent).join("/");
      return `[${escapeLinkText(segment.label)}](${TOKEN_HREF_PREFIX}${path})`;
    })
    .join("");
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

  return (
    <MessageAttachmentsContext value={attachments}>
      <StreamDownWrapper role={USER_ROLE} components={components}>
        {markdown}
      </StreamDownWrapper>
    </MessageAttachmentsContext>
  );
}
