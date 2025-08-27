import "server-only";

import { waitUntil } from "@vercel/functions";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { logger } from "../axiom/server";
import { serverConvexClient } from "../convex/server";

export async function serverUploadFileR2(data: {
  buffer: Uint8Array;
  threadId: Id<"threads">;
  mediaType: string;
}) {
  logger.debug("[Chat] Uploading file to R2", { threadId: data.threadId });

  const randomId = crypto.randomUUID();
  const attachmentId = await serverConvexClient.mutation(
    api.functions.attachments.createAttachment,
    {
      id: randomId,
      name: randomId,
      size: data.buffer.length,
      type: "image",
      threadId: data.threadId,
      source: "assistant",
    },
  );

  logger.debug("[Chat] Attachment created", { attachmentId, threadId: data.threadId });

  try {
    const { key, url } = await serverConvexClient.mutation(
      api.functions.files.generateAttachmentUploadUrl,
      { fileId: attachmentId, threadId: data.threadId },
    );

    const result = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": data.mediaType },
      body: data.buffer as BodyInit,
    });

    if (!result.ok) {
      throw new Error(`Failed to upload image: ${result.statusText}`);
    }

    waitUntil(serverConvexClient.mutation(api.functions.files.syncMetadata, { key }));
    logger.debug("[Chat] File uploaded to R2", { attachmentId, threadId: data.threadId });
  } catch (error) {
    logger.error("[Chat Error]: Failed to upload image to R2!", {
      error,
      attachmentId,
      threadId: data.threadId,
    });
  }

  return attachmentId;
}
