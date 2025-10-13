import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { logger } from "@/app/api/_server/chat";
import { type ServerConvexClient } from "../convex/server";
import { tryCatch } from "../utils";

type UploadFileR2 = {
  buffer: Uint8Array;
  threadId: Id<"threads">;
  mediaType: string;
  serverConvexClient: ServerConvexClient;
};

type UploadFileR2Response = {
  attachmentDocId: Id<"attachments">;
  filePathname: string;
};

export async function serverUploadFileR2(data: UploadFileR2): Promise<UploadFileR2Response | null> {
  const maxAttempts = 3;
  logger.info("[Chat] Uploading file to R2", {
    threadId: data.threadId,
    mediaType: data.mediaType,
  });

  try {
    const randomId = crypto.randomUUID();

    // Create attachment record first
    const { docId, uniqueId } = await data.serverConvexClient.mutation(
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
      uniqueId,
      docId,
      threadId: data.threadId,
      type: data.mediaType,
      size: data.buffer.length,
    });

    // Retry the upload flow up to maxAttempts
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        logger.info("[Chat] Generating upload URL", {
          attempt,
          maxAttempts,
          uniqueId,
          docId,
          threadId: data.threadId,
        });

        const { key, url } = await data.serverConvexClient.mutation(
          api.functions.files.generateAttachmentUploadUrl,
          { fileId: uniqueId, threadId: data.threadId, mimeType: data.mediaType },
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
            uniqueId,
            docId,
            threadId: data.threadId,
            status: result.status,
            error: message,
          });
          // Throw to trigger the catch for retry handling
          throw new Error(message);
        }

        // Fire-and-forget metadata sync
        tryCatch(data.serverConvexClient.mutation(api.functions.files.syncMetadata, { key }));

        logger.info("[Chat] File uploaded to R2", {
          attempt,
          uniqueId,
          docId,
          threadId: data.threadId,
        });
        return { attachmentDocId: docId, filePathname: key };
      } catch (err) {
        logger.error("[Chat Error]: Upload attempt exception", {
          attempt,
          maxAttempts,
          uniqueId,
          docId,
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
      uniqueId,
      docId,
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
