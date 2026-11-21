import type { StreamTokenizer, ThemedToken } from "@pierre/highlights";

/**
 * Tokenizes append-only code (a fence that is still streaming) by feeding only the new text to a
 * StreamTokenizer, so each update costs the size of the delta instead of the whole block.
 * Completed lines are highlighted; the unfinished last line is returned as plain text.
 */
export class IncrementalTokenizer {
  #tokenizer: StreamTokenizer | null = null;
  #key = "";
  #text = "";
  #lines: ThemedToken[][] = [];

  tokenize(code: string, key: string, create: () => StreamTokenizer): ThemedToken[][] {
    if (!this.#tokenizer || key !== this.#key || !code.startsWith(this.#text)) {
      this.dispose();
      this.#tokenizer = create();
      this.#key = key;
    }

    const delta = code.slice(this.#text.length);
    if (delta) {
      this.#lines = [...this.#lines, ...this.#tokenizer.pushCode(delta)];
      this.#text = code;
    }

    const partialStart = code.lastIndexOf("\n") + 1;
    const partial = code.slice(partialStart);
    const partialLine: ThemedToken[] = partial.trim()
      ? [{ content: partial, color: "inherit", offset: partialStart }]
      : [];

    return [...this.#lines, partialLine];
  }

  dispose() {
    this.#tokenizer?.dispose();
    this.#tokenizer = null;
    this.#key = "";
    this.#text = "";
    this.#lines = [];
  }
}
