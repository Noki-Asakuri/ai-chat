import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";
import type { UIMessage } from "@ai-chat/shared/chat/ui";

import type { FileUIPart } from "ai";
import { z } from "zod/v4";
import type { Context } from "hono";

import { logger } from "@/libs/axiom";
import { serverUploadFileR2 } from "@/libs/files";
import { buildAttachmentUrl } from "@/libs/files/assets";

const generatedImageOutputSchema = z.object({ result: z.string().min(1) });

export async function handleUploadFileAttachment(ctx: Context, threadId: Id<"threads">, message: UIMessage) {
  const attachmentIds: Array<Id<"attachments">> = [];
  const fileParts = message.parts.filter((part) => part.type === "file");

  async function uploadAndPatchUrl(filePart: FileUIPart) {
    // Already url, we don't patch these
    if (!filePart.url.startsWith("data:")) return;

    const [metadata, payload] = filePart.url.split(",", 2);
    if (!metadata?.endsWith(";base64") || !payload) return;

    const buffer = Buffer.from(payload, "base64");
    const uploadResult = await serverUploadFileR2(ctx, {
      buffer: buffer,
      mediaType: filePart.mediaType,
      threadId,
    });

    if (uploadResult.isErr()) return;

    const fileUploaded = uploadResult.value;
    const url = buildAttachmentUrl(fileUploaded.filePathname, filePart.mediaType);

    filePart.url = url;
    filePart.providerMetadata = undefined;
    attachmentIds.push(fileUploaded.attachmentDocId);

    logger.debug("[Chat] Patched file part", filePart);
  }

  const imageToolParts = message.parts.filter(
    (part) =>
      (part.type === "tool-image_generation" ||
        part.type === "tool-imageGeneration" ||
        (part.type === "dynamic-tool" &&
          (part.toolName === "image_generation" || part.toolName === "imageGeneration"))) &&
      part.state === "output-available" &&
      part.preliminary !== true,
  );

  await Promise.all([
    ...fileParts.map(uploadAndPatchUrl),
    ...imageToolParts.map(async (part) => {
      if ("state" in part && part.state === "output-available") {
        const output = generatedImageOutputSchema.safeParse(part.output);
        if (!output.success) return;

        const uploadResult = await serverUploadFileR2(ctx, {
          buffer: Buffer.from(output.data.result, "base64"),
          mediaType: "image/webp",
          threadId,
        });

        if (uploadResult.isErr()) {
          message.parts[message.parts.indexOf(part)] = {
            ...part,
            state: "output-error",
            output: undefined,
            errorText: "The generated image could not be saved. Please try again.",
          };
          logger.error("[Chat] Failed to save generated image", uploadResult.error);
          return;
        }

        part.output = {
          url: buildAttachmentUrl(uploadResult.value.filePathname, "image/webp"),
        };
        attachmentIds.push(uploadResult.value.attachmentDocId);
      }
    }),
  ]);
  return attachmentIds;
}
