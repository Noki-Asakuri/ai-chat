import { fromText, type Token } from "@ui-sdk/core/token-input";

type MessageContentPart = {
  type: string;
  text?: string;
};

export function hasMessageContent(parts: readonly MessageContentPart[], attachmentCount: number): boolean {
  if (attachmentCount > 0) return true;

  return parts.some((part) => {
    if (part.type === "step-start") return false;

    if (part.type === "text" || part.type === "reasoning") {
      return (part.text?.trim().length ?? 0) > 0;
    }

    return true;
  });
}

export type MessageTextSegment =
  | {
      kind: "text";
      /** The text as typed, the codec's escapes undone. */
      text: string;
    }
  | { kind: "token"; type: string; value: string; label: string };

/**
 * Splits saved message text into text and chips with the composer's own codec, so chip-like text
 * the codec escaped, such as a typed literal or a file name, stays text.
 */
export function splitMessageTokens(text: string): MessageTextSegment[] {
  return fromText(text).flatMap((segment): MessageTextSegment[] => {
    if (isToken(segment)) {
      return [{ kind: "token", type: segment.type, value: segment.value, label: segment.label }];
    }
    return segment === "" ? [] : [{ kind: "text", text: segment }];
  });
}

function isToken(segment: string | Token): segment is Token {
  return segment instanceof Object;
}

/** Saved message text as the model reads it: chips become their labels and text reads as typed. */
export function toPlainMessageText(text: string): string {
  return splitMessageTokens(text)
    .map((segment) => (segment.kind === "text" ? segment.text : segment.label))
    .join("");
}

export type AttachmentNameMatch = { index: number; name: string; id: string };

function escapeRegExp(text: string): string {
  return text.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Finds where a message's own attachments are named in its text, for messages saved before file chips.
// A name counts only as a whole word: not inside a longer file name, though a trailing period may end the sentence.
export function findAttachmentNames(
  text: string,
  attachments: ReadonlyArray<{ _id: string; name: string }>,
): AttachmentNameMatch[] {
  const idByName = new Map<string, string>();
  for (const attachment of attachments) {
    if (attachment.name.trim().length > 0 && !idByName.has(attachment.name)) {
      idByName.set(attachment.name, attachment._id);
    }
  }
  if (idByName.size === 0) return [];

  const names = [...idByName.keys()].toSorted((a, b) => b.length - a.length).map(escapeRegExp);
  const pattern = new RegExp(`(?<![\\w.-])(?:${names.join("|")})(?![\\w-])(?!\\.\\w)`, "g");

  return [...text.matchAll(pattern)].flatMap((match) => {
    const id = idByName.get(match[0]);
    return id ? [{ index: match.index, name: match[0], id }] : [];
  });
}
