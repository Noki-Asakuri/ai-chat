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

// The composer codec's chip, `[@label](type:value)`: the label escapes `\`, `[` and `]`, and the
// value escapes `\`, `(` and `)`. Sticky, so it only matches where the parser points it.
const CHIP_PATTERN = /\[@((?:\\[\s\S]|[^\\\]])*)\]\(([\w-]+):((?:\\[\s\S]|[^\\()])*)\)/y;

const unescapeChipPart = (text: string): string => text.replaceAll(/\\([\s\S])/g, "$1");

export type MessageTextSegment =
  | {
      kind: "text";
      /** The text as saved, with the codec's escapes. Markdown reads those escapes the same way. */
      text: string;
      /** The text as typed. */
      plain: string;
    }
  | { kind: "token"; type: string; value: string; label: string };

/**
 * Splits saved message text into text and chips, reading it back the way the composer's codec does
 * (`fromText` in @ui-sdk/core's token input). So chip-like text the codec escaped, such as a typed
 * literal or a file name, stays text. A run of backslashes is counted once, so long runs stay fast.
 */
export function splitMessageTokens(text: string): MessageTextSegment[] {
  const segments: MessageTextSegment[] = [];
  // Where the current text segment starts, how far the scan has read, and that text as typed so far.
  let start = 0;
  let index = 0;
  let plain = "";

  for (let bracket = text.indexOf("[@"); bracket !== -1; bracket = text.indexOf("[@", index)) {
    let slashes = 0;
    while (bracket - slashes - 1 >= index && text[bracket - slashes - 1] === "\\") slashes++;

    // The codec doubles backslashes before `[@`, and adds one more when the bracket is literal.
    plain += text.slice(index, bracket - slashes) + "\\".repeat(Math.floor(slashes / 2));
    index = bracket + 2;

    CHIP_PATTERN.lastIndex = bracket;
    const chip = slashes % 2 === 0 ? CHIP_PATTERN.exec(text) : null;
    if (!chip) {
      plain += "[@";
      continue;
    }

    const [whole, label = "", type = "", value = ""] = chip;
    if (bracket > start) segments.push({ kind: "text", text: text.slice(start, bracket), plain });
    segments.push({ kind: "token", type, value: unescapeChipPart(value), label: unescapeChipPart(label) });
    start = index = bracket + whole.length;
    plain = "";
  }

  if (start < text.length) {
    segments.push({ kind: "text", text: text.slice(start), plain: plain + text.slice(index) });
  }
  return segments;
}

/** Saved message text as the model reads it: chips become their labels and text reads as typed. */
export function toPlainMessageText(text: string): string {
  return splitMessageTokens(text)
    .map((segment) => (segment.kind === "text" ? segment.plain : segment.label))
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
