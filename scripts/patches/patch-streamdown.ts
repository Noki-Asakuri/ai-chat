import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// streamdown 2.3.0
const filePath = resolve(process.cwd(), "node_modules/streamdown/dist/chunk-RLXIAIE6.js");

const oldSnippet = 'useEffect(()=>{t==="streaming"?B(()=>{v(I);}):v(I);},[I,t]);';
const newSnippet = "useEffect(()=>{v(I);},[I,t]);";

function main() {
  let contents: string;
  try {
    contents = readFileSync(filePath, "utf8");
  } catch {
    // If dependencies aren't installed, don't fail installs/builds.
    console.warn(`[patch-streamdown] Skipping; file not found: ${filePath}`);
    return;
  }

  if (contents.includes(newSnippet)) {
    console.log("[patch-streamdown] Already patched.");
    return;
  }

  if (!contents.includes(oldSnippet)) {
    console.warn(
      "[patch-streamdown] Target snippet not found (package updated?). No changes made.",
    );
    return;
  }

  writeFileSync(filePath, contents.replace(oldSnippet, newSnippet), "utf8");
  console.log("[patch-streamdown] Patch applied.");
}

main();
