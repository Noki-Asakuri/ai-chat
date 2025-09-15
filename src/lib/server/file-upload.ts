import "server-only";

import { waitUntil } from "@vercel/functions";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { logger } from "../axiom/server";
import { serverConvexClient } from "../convex/server";
import { tryCatch } from "../utils";

export async function serverUploadFileR2(data: {
  buffer: Uint8Array;
  threadId: Id<"threads">;
  mediaType: string;
}): Promise<Id<"attachments"> | null> {
  const maxAttempts = 3;
  console.log("[Chat] Uploading file to R2", {
    threadId: data.threadId,
    mediaType: data.mediaType,
  });
  logger.info("[Chat] Uploading file to R2", {
    threadId: data.threadId,
    mediaType: data.mediaType,
  });

  try {
    const randomId = crypto.randomUUID();

    // Create attachment record first
    const attachmentId = await serverConvexClient.mutation(
      api.functions.attachments.createAttachment,
      {
        id: randomId,
        name: randomId,
        threadId: data.threadId,
        size: data.buffer.length,
        type: "image",
        source: "assistant",
        mimeType: data.mediaType,
      },
    );

    logger.info("[Chat] Attachment created", {
      attachmentId,
      threadId: data.threadId,
      type: data.mediaType,
    });

    // Retry the upload flow up to maxAttempts
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        logger.info("[Chat] Generating upload URL", {
          attempt,
          maxAttempts,
          attachmentId,
          threadId: data.threadId,
        });

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
          const errorText = await result.text();
          const message = `Failed to upload image: ${result.status} ${result.statusText} - ${errorText}`;
          logger.error("[Chat Error]: Upload attempt failed", {
            attempt,
            maxAttempts,
            attachmentId,
            threadId: data.threadId,
            status: result.status,
            error: message,
          });
          // Throw to trigger the catch for retry handling
          throw new Error(message);
        }

        // Fire-and-forget metadata sync
        waitUntil(tryCatch(serverConvexClient.mutation(api.functions.files.syncMetadata, { key })));

        logger.info("[Chat] File uploaded to R2", {
          attempt,
          attachmentId,
          threadId: data.threadId,
        });
        return attachmentId;
      } catch (err) {
        logger.error("[Chat Error]: Upload attempt exception", {
          attempt,
          maxAttempts,
          attachmentId,
          threadId: data.threadId,
          error: err,
        });

        // Backoff before retrying (simple linear backoff)
        if (attempt < maxAttempts) {
          await new Promise<void>((resolve) => setTimeout(resolve, 250 * attempt));
        }
      }
    }

    // If we get here, all attempts failed
    logger.error("[Chat Error]: All upload attempts failed", {
      attachmentId,
      threadId: data.threadId,
      attempts: maxAttempts,
    });

    return null;
  } catch (error) {
    logger.error("[Chat Error]: Unexpected failure during file upload", {
      error,
      threadId: data.threadId,
    });

    return null;
  }
}
