import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { getConvexReactClient } from "./client";

import { tryCatch } from "../utils";

const convexClient = getConvexReactClient();

export async function uploadFileToR2(
  file: File,
  data: { threadId: Id<"threads">; fileId: string; sessionId: string },
) {
  const { url, key: filePath } = await convexClient.mutation(
    api.functions.files.generateAttachmentUploadUrl,
    { mimeType: file.type, ...data },
  );

  const [, error] = await tryCatch(async () => {
    const result = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });

    if (!result.ok) throw new Error(`Failed to upload image: ${result.statusText}`);
  });

  if (error) throw error;

  await convexClient.mutation(api.functions.files.syncMetadata, { key: filePath });
  return filePath;
}

/**
 * Upload an AI Profile image to R2 via a pre-signed URL.
 * Returns the R2 key that should be saved on the profile (imageKey).
 */
export async function uploadAiProfileImage(file: File, sessionId: string) {
  const { url, key } = await convexClient.mutation(
    api.functions.profiles.generateAiProfileUploadUrl,
    { sessionId },
  );

  const [, error] = await tryCatch(async () => {
    const result = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });

    if (!result.ok) throw new Error(`Failed to upload AI Profile image: ${result.statusText}`);
  });

  if (error) throw error;

  await convexClient.mutation(api.functions.files.syncMetadata, { key });
  return key;
}
