const FENCE_LINE_REGEX = /^```[ \t]*$/;

type Segment = {
  text: string;
  transform: boolean;
};

export function fixLatexMath(text: string): string {
  const segments = splitByCodeFences(text);
  let result = "";

  for (const segment of segments) {
    result += segment.transform ? fixLatexOutsideInlineCode(segment.text) : segment.text;
  }

  return result;
}

function splitByCodeFences(text: string): Array<Segment> {
  const parts = text.split(/(\r?\n)/);
  const segments: Array<Segment> = [];
  let proseBuffer = "";
  let fenceBuffer = "";
  let inFence = false;

  for (let i = 0; i < parts.length; i += 2) {
    const line = parts[i] ?? "";
    const newline = parts[i + 1] ?? "";
    const fullLine = line + newline;
    const trimmedLine = line.trimStart();

    if (inFence) {
      fenceBuffer += fullLine;

      if (FENCE_LINE_REGEX.test(trimmedLine)) {
        segments.push({ text: fenceBuffer, transform: false });
        fenceBuffer = "";
        inFence = false;
      }

      continue;
    }

    if (trimmedLine.startsWith("```")) {
      if (proseBuffer !== "") {
        segments.push({ text: proseBuffer, transform: true });
        proseBuffer = "";
      }

      fenceBuffer = fullLine;
      inFence = true;
      continue;
    }

    proseBuffer += fullLine;
  }

  if (proseBuffer !== "") {
    segments.push({ text: proseBuffer, transform: true });
  }

  if (fenceBuffer !== "") {
    segments.push({ text: fenceBuffer, transform: false });
  }

  return segments;
}

function fixLatexOutsideInlineCode(text: string): string {
  let result = "";
  let index = 0;

  while (index < text.length) {
    const backtickIndex = text.indexOf("`", index);

    if (backtickIndex === -1) {
      result += fixLatexInProse(text.slice(index));
      break;
    }

    result += fixLatexInProse(text.slice(index, backtickIndex));

    const delimiterLength = getBacktickRunLength(text, backtickIndex);
    const closingIndex = findClosingBacktickRun(
      text,
      backtickIndex + delimiterLength,
      delimiterLength,
    );

    if (closingIndex === -1) {
      result += text.slice(backtickIndex);
      break;
    }

    result += text.slice(backtickIndex, closingIndex + delimiterLength);
    index = closingIndex + delimiterLength;
  }

  return result;
}

function fixLatexInProse(text: string): string {
  const fixedDelimiters = text
    .replace(/\\(\(|\[)/g, function replaceOpeningDelimiter(_, delimiter: string) {
      return delimiter === "(" ? "$ " : "$$\n";
    })
    .replace(/\\(\)|\])/g, function replaceClosingDelimiter(_, delimiter: string) {
      return delimiter === ")" ? " $" : "\n$$";
    })
    .replace(/\$\$[\w].*(\n)[\W\w].*\$\$/g, function collapseDisplayMathLines(match) {
      return match.replace(/\n/g, " ");
    });

  return escapeCurrencyDollarSigns(fixedDelimiters);
}

function escapeCurrencyDollarSigns(text: string): string {
  let result = "";

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char !== "$") {
      result += char;
      continue;
    }

    const previousChar = text[i - 1] ?? "";
    const nextChar = text[i + 1] ?? "";

    if (previousChar === "\\" || previousChar === "$" || nextChar === "$") {
      result += char;
      continue;
    }

    if (isCurrencyDollarSign(text, i)) {
      result += "\\$";
      continue;
    }

    result += char;
  }

  return result.replace(/\\[ \t]+\\\$(?=\d)/g, "\\$");
}

function isCurrencyDollarSign(text: string, index: number): boolean {
  const previousChar = text[index - 1] ?? "";
  const nextChar = text[index + 1] ?? "";

  if (/\d/.test(nextChar)) return true;
  if (/\d|[A-Za-z]/.test(previousChar) && (nextChar === "" || /\s|[.,;:!?)]/.test(nextChar))) {
    return true;
  }

  return false;
}

function getBacktickRunLength(text: string, startIndex: number): number {
  let length = 0;

  while (text[startIndex + length] === "`") {
    length += 1;
  }

  return length;
}

function findClosingBacktickRun(text: string, startIndex: number, delimiterLength: number): number {
  let index = startIndex;

  while (index < text.length) {
    if (text[index] !== "`") {
      index += 1;
      continue;
    }

    const runLength = getBacktickRunLength(text, index);

    if (runLength === delimiterLength) {
      return index;
    }

    index += runLength;
  }

  return -1;
}
