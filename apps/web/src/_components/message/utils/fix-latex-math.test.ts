import { describe, expect, test } from "bun:test";

import { fixLatexMath } from "./fix-latex-math";

describe("fixLatexMath", function () {
  test("converts latex delimiters in prose", function () {
    const input = "Inline \\(a+b\\) and block \\[x^2 + y^2\\]";

    expect(fixLatexMath(input)).toBe("Inline $ a+b $ and block $$\nx^2 + y^2\n$$");
  });

  test("preserves fenced code blocks", function () {
    const input = [
      "Before \\(x\\)",
      "```ts",
      "const sample = String.raw`\\(x\\) \\[y\\]`",
      "```",
      "After \\[z\\]",
    ].join("\n");

    const expected = [
      "Before $ x $",
      "```ts",
      "const sample = String.raw`\\(x\\) \\[y\\]`",
      "```",
      "After $$",
      "z",
      "$$",
    ].join("\n");

    expect(fixLatexMath(input)).toBe(expected);
  });

  test("preserves inline code spans", function () {
    const input = "Use `\\(literal\\)` but render \\(math\\).";

    expect(fixLatexMath(input)).toBe("Use `\\(literal\\)` but render $ math $.");
  });

  test("handles mixed prose, inline code, and fenced code", function () {
    const input = [
      "Prose \\(a\\) and `\\(b\\)`.",
      "```plaintext",
      "\\(c\\)",
      "```",
      "Tail \\[d\\]",
    ].join("\n");

    const expected = [
      "Prose $ a $ and `\\(b\\)`.",
      "```plaintext",
      "\\(c\\)",
      "```",
      "Tail $$",
      "d",
      "$$",
    ].join("\n");

    expect(fixLatexMath(input)).toBe(expected);
  });

  test("preserves unmatched inline code spans", function () {
    const input = "Start `\\(literal\\) and leave \\(later\\) untouched";

    expect(fixLatexMath(input)).toBe(input);
  });

  test("escapes currency dollar signs before math parsing", function () {
    const input = "At \\ $1,000 per week, to reach \\ $1,000,000:";

    expect(fixLatexMath(input)).toBe("At \\$1,000 per week, to reach \\$1,000,000:");
  });

  test("escapes trailing currency dollar signs", function () {
    const input = "1k$ per week, how much until it reach 1M$";

    expect(fixLatexMath(input)).toBe("1k\\$ per week, how much until it reach 1M\\$");
  });

  test("keeps explicit inline and display math delimiters", function () {
    const input = "Inline \\(a+b\\), raw $ c+d $, and block $$\nx^2\n$$";

    expect(fixLatexMath(input)).toBe("Inline $ a+b $, raw $ c+d $, and block $$\nx^2\n$$");
  });
});
