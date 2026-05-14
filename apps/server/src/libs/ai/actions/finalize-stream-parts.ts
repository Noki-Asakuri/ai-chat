import type { UIChatMessage } from "../types";

export function finalizeStreamParts(message: UIChatMessage): UIChatMessage["parts"] {
  const out: UIChatMessage["parts"] = [];

  for (const part of message.parts) {
    switch (part.type) {
      case "text":
      case "reasoning": {
        const content = part.text.trim();
        if (content.length === 0 && part.type === "reasoning") continue;

        if (part.type === "reasoning") part.providerMetadata = undefined;
        part.state = "done";
      }

      default:
        out.push(part);
    }
  }

  return out;
}
