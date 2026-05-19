type NormalizeCodeFenceLanguagesOptions = {
  passthroughLanguages: ReadonlySet<string>;
};

const FENCE_START_REGEX = /^(```+|~~~+)(.*)$/;
const ORIGINAL_LANGUAGE_META_PREFIX = "sdOriginalLanguage=";
const BLOCKQUOTE_PREFIX_REGEX = /^([ \t]*(?:>[ \t]?)+)(.*)$/;

export function extractOriginalFenceLanguage(meta: string | undefined): string | null {
  if (!meta) return null;

  const markerIndex = meta.indexOf(ORIGINAL_LANGUAGE_META_PREFIX);
  if (markerIndex < 0) return null;

  const valueStart = markerIndex + ORIGINAL_LANGUAGE_META_PREFIX.length;
  if (meta[valueStart] !== '"') return null;

  let value = "";
  let escaped = false;

  for (let i = valueStart + 1; i < meta.length; i++) {
    const char = meta[i];
    if (!char) break;

    if (escaped) {
      value += char;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === '"') {
      return value;
    }

    value += char;
  }

  return null;
}

function escapeMetaString(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function stripBlockquotePrefix(line: string): {
  content: string;
  prefix: string;
} {
  const match = line.match(BLOCKQUOTE_PREFIX_REGEX);

  if (!match) {
    return { content: line, prefix: "" };
  }

  return {
    content: match[2] ?? "",
    prefix: match[1] ?? "",
  };
}

export function normalizeCodeFenceLanguages(
  text: string,
  options: NormalizeCodeFenceLanguagesOptions,
): string {
  const parts = text.split(/(\r?\n)/);
  let output = "";
  let openFenceMarker: string | null = null;

  for (let i = 0; i < parts.length; i += 2) {
    const line = parts[i] ?? "";
    const newline = parts[i + 1] ?? "";
    const blockquoteLine = stripBlockquotePrefix(line);
    const trimmedLine = blockquoteLine.content.trimStart();

    if (openFenceMarker) {
      if (trimmedLine.startsWith(openFenceMarker)) {
        openFenceMarker = null;
      }

      output += line + newline;
      continue;
    }

    const match = trimmedLine.match(FENCE_START_REGEX);
    if (!match) {
      output += line + newline;
      continue;
    }

    const marker = match[1] ?? "";
    const info = (match[2] ?? "").trim();
    if (!info) {
      output += line + newline;
      openFenceMarker = marker;
      continue;
    }

    const languageEndIndex = info.search(/\s/);
    const language = languageEndIndex >= 0 ? info.slice(0, languageEndIndex) : info;
    const meta = languageEndIndex >= 0 ? info.slice(languageEndIndex).trimStart() : "";
    const normalizedLanguage = language.toLowerCase();

    if (options.passthroughLanguages.has(normalizedLanguage)) {
      output += line + newline;
      openFenceMarker = marker;
      continue;
    }

    const leadingWhitespace =
      blockquoteLine.prefix +
      blockquoteLine.content.slice(0, blockquoteLine.content.length - trimmedLine.length);
    const originalLanguageMeta = `${ORIGINAL_LANGUAGE_META_PREFIX}"${escapeMetaString(language)}"`;
    const nextMeta = meta ? `${originalLanguageMeta} ${meta}` : originalLanguageMeta;

    output += `${leadingWhitespace}${marker}text ${nextMeta}${newline}`;
    openFenceMarker = marker;
  }

  return output;
}
