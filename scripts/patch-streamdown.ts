import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const filePath = resolve(process.cwd(), "node_modules/streamdown/dist/chunk-4PGIZLGZ.js");

const oldSnippet = 'useEffect(()=>{t==="streaming"?C(()=>{E(S);}):E(S);},[S,t]);';
const newSnippet = "useEffect(()=>{E(S);},[S,t]);";

function main() {
  let contents: string;
  try {
    contents = readFileSync(filePath, "utf8");
  } catch (error) {
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
