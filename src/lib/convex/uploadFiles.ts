import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { getConvexReactClient } from "./client";

const convexClient = getConvexReactClient();

export async function uploadFile(file: File, threadId: Id<"threads">, fileId: string) {
  const { url, key } = await convexClient.mutation(api.files.generateUploadUrl, {
    threadId,
    fileId,
  });

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
  await convexClient.mutation(api.files.syncMetadata, { key });
  return key;
}
