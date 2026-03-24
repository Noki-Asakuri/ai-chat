export function addMissingFenceLanguages(text: string): string {
  const parts = text.split(/(\r?\n)/);
  let out = "";
  let inFence = false;

  for (let i = 0; i < parts.length; i += 2) {
    const line = parts[i] ?? "";
    const newline = parts[i + 1] ?? "";
    const trimmedLine = line.trimStart();
    const isBareTripleBacktickFence = /^```[ \t]*$/.test(trimmedLine);

    if (!inFence && trimmedLine.startsWith("```")) {
      if (isBareTripleBacktickFence) {
        const leadingWhitespace = line.slice(0, line.length - trimmedLine.length);
        out += leadingWhitespace + "```plaintext" + newline;
      } else {
        out += line + newline;
      }

      inFence = true;
      continue;
    }

    if (inFence && isBareTripleBacktickFence) {
      inFence = false;
    }

    out += line + newline;
  }

  return out;
}
