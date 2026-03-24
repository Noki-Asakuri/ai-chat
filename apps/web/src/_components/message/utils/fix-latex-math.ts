export function fixLatexMath(text: string): string {
  return text
    .replace(/\\(\(|\[)/g, (_, p1) => {
      return p1 === "(" ? "$ " : "$$\n";
    })
    .replace(/\\(\)|\])/g, (_, p1) => {
      return p1 === ")" ? " $" : "\n$$";
    })
    .replace(/\$\$[\w].*(\n)[\W\w].*\$\$/g, (match) => {
      return match.replace(/\n/g, " ");
    });
}
