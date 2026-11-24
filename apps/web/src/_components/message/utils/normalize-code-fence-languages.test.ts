import { describe, expect, test } from "bun:test";

import {
  extractOriginalFenceLanguage,
  normalizeCodeFenceLanguages,
} from "./normalize-code-fence-languages";

const passthroughLanguages = new Set(["mermaid"]);

describe("normalizeCodeFenceLanguages", function () {
  test("normalizes normal languages to text with original language metadata", function () {
    const markdown = ["```ts", "const value = 1;", "```"].join("\n");

    expect(normalizeCodeFenceLanguages(markdown, { passthroughLanguages })).toBe(
      ['```text sdOriginalLanguage="ts"', "const value = 1;", "```"].join("\n"),
    );
  });

  test("preserves passthrough languages", function () {
    const markdown = ["```mermaid", "graph TD", "A-->B", "```"].join("\n");

    expect(normalizeCodeFenceLanguages(markdown, { passthroughLanguages })).toBe(markdown);
  });

  test("normalizes unknown languages to text with original language metadata", function () {
    const markdown = ["```random-text-header", "plain text", "```"].join("\n");

    expect(normalizeCodeFenceLanguages(markdown, { passthroughLanguages })).toBe(
      ['```text sdOriginalLanguage="random-text-header"', "plain text", "```"].join("\n"),
    );
  });

  test("preserves existing metadata after original language metadata", function () {
    const markdown = ['```custom title="Demo"', "plain text", "```"].join("\n");

    expect(normalizeCodeFenceLanguages(markdown, { passthroughLanguages })).toBe(
      ['```text sdOriginalLanguage="custom" title="Demo"', "plain text", "```"].join("\n"),
    );
  });

  test("normalizes languages inside blockquotes", function () {
    const markdown = [
      "> ```typescript",
      "> function add(a: number, b: number): number {",
      ">   return a + b;",
      "> }",
      "> ```",
    ].join("\n");

    expect(normalizeCodeFenceLanguages(markdown, { passthroughLanguages })).toBe(
      [
        '> ```text sdOriginalLanguage="typescript"',
        "> function add(a: number, b: number): number {",
        ">   return a + b;",
        "> }",
        "> ```",
      ].join("\n"),
    );
  });

  test("preserves nested blockquote prefixes when normalizing languages", function () {
    const markdown = ["> > ~~~tsx title=\"Demo\"", "> > <Component />", "> > ~~~"].join("\n");

    expect(normalizeCodeFenceLanguages(markdown, { passthroughLanguages })).toBe(
      [
        '> > ~~~text sdOriginalLanguage="tsx" title="Demo"',
        "> > <Component />",
        "> > ~~~",
      ].join("\n"),
    );
  });
});

describe("extractOriginalFenceLanguage", function () {
  test("extracts escaped original language metadata", function () {
    expect(extractOriginalFenceLanguage('sdOriginalLanguage="weird\\"lang" title="Demo"')).toBe(
      'weird"lang',
    );
  });

  test("returns null when metadata is missing", function () {
    expect(extractOriginalFenceLanguage('title="Demo"')).toBeNull();
  });
});
