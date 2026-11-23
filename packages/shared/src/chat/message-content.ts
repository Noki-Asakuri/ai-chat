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
