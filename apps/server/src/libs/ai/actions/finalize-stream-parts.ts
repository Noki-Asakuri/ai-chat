import type { UIChatMessage } from "../types";

export function finalizeStreamParts(message: UIChatMessage): UIChatMessage["parts"] {
  const out: UIChatMessage["parts"] = [];

  for (const part of message.parts) {
    if (
      (part.type === "tool-image_generation" ||
        part.type === "tool-imageGeneration" ||
        (part.type === "dynamic-tool" &&
          (part.toolName === "image_generation" || part.toolName === "imageGeneration"))) &&
      part.state === "output-available" &&
      part.preliminary === true
    ) {
      out.push({
        ...part,
        state: "output-error",
        output: undefined,
        errorText: "Image generation stopped before the image was finished. Please try again.",
      });
      continue;
    }

    switch (part.type) {
      case "text":
      case "reasoning": {
        const content = part.text.trim();
        if (content.length === 0 && part.type === "reasoning") continue;

        part.text = content;
        if (part.type === "reasoning") part.providerMetadata = undefined;
        part.state = "done";
        out.push(part);
        break;
      }

      case "reasoning-file": {
        // Reasoning files belong to the private reasoning trace. Preserve them
        // in message history without treating them as user-visible attachments.
        out.push(part);
        break;
      }

      default:
        out.push(part);
    }
  }

  return out;
}
