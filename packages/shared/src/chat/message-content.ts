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

// Matches the composer codec's `[@label](type:value)`, where the label escapes `\`, `[` and `]`.
const MESSAGE_TOKEN_PATTERN = /\[@((?:\\.|[^\\\]])*)\]\(([\w-]+):([^\s)]*)\)/g;

export type MessageTextSegment =
  { kind: "text"; text: string } | { kind: "token"; type: string; value: string; label: string };

export function splitMessageTokens(text: string): MessageTextSegment[] {
  const segments: MessageTextSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(MESSAGE_TOKEN_PATTERN)) {
    const [whole, label = "", type = "", value = ""] = match;
    if (match.index > lastIndex) segments.push({ kind: "text", text: text.slice(lastIndex, match.index) });
    segments.push({ kind: "token", type, value, label: label.replaceAll(/\\(.)/g, "$1") });
    lastIndex = match.index + whole.length;
  }

  if (lastIndex < text.length) segments.push({ kind: "text", text: text.slice(lastIndex) });
  return segments;
}

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
