import { splitMessageTokens } from "@ai-chat/shared/chat/message-content";

// Matches the web composer's file chip type, `[@name](file:attachmentId)`.
const FILE_TOKEN_TYPE = "file";

type StoredMessagePart = { type: string; text?: string; mediaType?: string };

export type ThreadTitleInput = { kind: "summarize"; text: string } | { kind: "fixed"; title: string };

/**
 * Decides how to title a thread from its first user message, as stored with composer chips still marked up.
 * A message whose only text is `@` file chips counts as attachment-only, the same as one with no text.
 */
export function getThreadTitleInput(parts: readonly StoredMessagePart[]): ThreadTitleInput {
  const texts: string[] = [];
  let hasTypedText = false;
  // By attachment id: the composer sends a file once however many times it is referenced.
  const fileChipIds = new Set<string>();

  for (const part of parts) {
    if (part.type !== "text" || !part.text) continue;

    let plain = "";
    for (const segment of splitMessageTokens(part.text)) {
      if (segment.kind === "text") {
        plain += segment.text;
        if (segment.text.trim()) hasTypedText = true;
        continue;
      }

      plain += segment.label;
      if (segment.type === FILE_TOKEN_TYPE) fileChipIds.add(segment.value);
      else if (segment.label.trim()) hasTypedText = true;
    }

    if (plain.trim()) texts.push(plain.trim());
  }

  if (hasTypedText) return { kind: "summarize", text: texts.join("\n\n") };

  const fileMediaTypes = parts.flatMap((part) =>
    part.type === "file" && part.mediaType !== undefined ? [part.mediaType] : [],
  );
  return { kind: "fixed", title: getAttachmentOnlyTitle(fileMediaTypes, fileChipIds.size) };
}

function getAttachmentOnlyTitle(fileMediaTypes: readonly string[], fileChipCount: number): string {
  // File parts exist only for files the model can read, while chips also name the ones it skipped.
  const count = Math.max(fileMediaTypes.length, fileChipCount);
  if (count === 0) return "New Chat";

  const allImages =
    fileMediaTypes.length === count && fileMediaTypes.every((mediaType) => mediaType.startsWith("image/"));
  if (allImages) return count === 1 ? "Shared image" : "Shared images";
  return count === 1 ? "Shared file" : "Shared files";
}
