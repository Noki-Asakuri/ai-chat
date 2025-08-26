import "server-only";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { serverConvexClient } from "../convex/server";

export async function serverUploadFileR2(data: {
  buffer: Uint8Array;
  threadId: Id<"threads">;
  mediaType: string;
}) {
  const randomId = crypto.randomUUID();
  const attachmentId = await serverConvexClient.mutation(
    api.functions.attachments.createAttachment,
    {
      id: randomId,
      name: randomId,
      size: data.buffer.length,
      type: "image",
      threadId: data.threadId,
    },
  );

  const { key, url } = await serverConvexClient.mutation(
    api.functions.files.generateAttachmentUploadUrl,
    { fileId: attachmentId, threadId: data.threadId },
  );

  try {
    const result = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": data.mediaType },
      body: data.buffer as BodyInit,
    });

    if (!result.ok) {
      throw new Error(`Failed to upload image: ${result.statusText}`);
    }

    await serverConvexClient.mutation(api.functions.files.syncMetadata, { key });
    return attachmentId;
  } catch (error) {
    throw new Error(`Failed to upload image: ${error}`);
  }
}
