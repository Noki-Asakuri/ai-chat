import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const filePath = resolve(process.cwd(), "node_modules/streamdown/dist/chunk-5FQGJX7Z.js");

const oldSnippet = 'useEffect(()=>{t==="streaming"?P(()=>{A(L);}):A(L);},[L,t]);';
const newSnippet = "useEffect(()=>{A(L);},[L,t]);";

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
