import { describe, expect, test } from "bun:test";

import { codeToTokens, type CodeToTokensOptions, StreamTokenizer } from "@pierre/highlights";
import oneDarkPro from "@pierre/highlights/themes/one-dark-pro";

import { IncrementalTokenizer } from "./incremental-tokenizer";

const options: CodeToTokensOptions = { lang: "ts", themes: { light: oneDarkPro } };
const source = [
  "/* a multi-line",
  "   comment */",
  "const greeting = `hello",
  "${name}`;",
  "export function add(a: number, b: number) {",
  "  return a + b;",
  "}",
].join("\n");

const strip = (lines: { content: string; htmlStyle?: unknown }[][]) =>
  lines.map((line) => line.map(({ content, htmlStyle }) => ({ content, htmlStyle })));

describe("IncrementalTokenizer", () => {
  test("streamed chunks match full tokenization for completed lines", () => {
    const incremental = new IncrementalTokenizer();
    let tokens: ReturnType<IncrementalTokenizer["tokenize"]> = [];

    for (let end = 3; end <= source.length; end += 7) {
      tokens = incremental.tokenize(source.slice(0, end), "ts", () => new StreamTokenizer(options));
    }
    tokens = incremental.tokenize(source, "ts", () => new StreamTokenizer(options));
    incremental.dispose();

    const full = codeToTokens(source, options).tokens;
    expect(tokens).toHaveLength(full.length);
    expect(strip(tokens.slice(0, -1))).toEqual(strip(full.slice(0, -1)));
    expect(tokens.at(-1)?.map((token) => token.content).join("")).toBe("}");
  });

  test("restarts when earlier text changes", () => {
    const incremental = new IncrementalTokenizer();
    incremental.tokenize("const a = 1;\nconst b", "ts", () => new StreamTokenizer(options));
    const tokens = incremental.tokenize("let x = 1;\n", "ts", () => new StreamTokenizer(options));
    incremental.dispose();

    expect(tokens[0]?.map((token) => token.content).join("")).toBe("let x = 1;");
  });
});
