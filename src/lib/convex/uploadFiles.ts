import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { getConvexReactClient } from "./client";

const convexClient = getConvexReactClient();

export async function uploadFile(file: File, threadId: Id<"threads">, fileId: Id<"attachments">) {
  const { url, key } = await convexClient.mutation(
    api.functions.files.generateAttachmentUploadUrl,
    { threadId, fileId },
  );

  try {
    const result = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });

    if (!result.ok) {
      throw new Error(`Failed to upload image: ${result.statusText}`);
    }
  } catch (error) {
    throw new Error(`Failed to upload image: ${error}`);
  }
  await convexClient.mutation(api.functions.files.syncMetadata, { key });
  return key;
}

/**
 * Upload an AI Profile image to R2 via a pre-signed URL.
 * Returns the R2 key that should be saved on the profile (imageKey).
 */
export async function uploadAiProfileImage(file: File) {
  const { url, key } = await convexClient.mutation(
    api.functions.aiProfiles.generateAiProfileUploadUrl,
    {},
  );

  try {
    const result = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!result.ok) {
      throw new Error(`Failed to upload AI Profile image: ${result.statusText}`);
    }
  } catch (error) {
    throw new Error(`Failed to upload AI Profile image: ${error}`);
  }

  // We don't currently use syncMetadata for profile images.
  // The key is sufficient to construct a CDN URL.
  return key;
}
