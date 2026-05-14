import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";
import type { UIMessage } from "@ai-chat/shared/chat/ui";

import type { FileUIPart } from "ai";
import type { Context } from "hono";

import { logger } from "@/libs/axiom";
import { serverUploadFileR2 } from "@/libs/files";
import { buildAttachmentUrl } from "@/libs/files/assets";

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

  await Promise.all(fileParts.map(uploadAndPatchUrl));
  return attachmentIds;
}
