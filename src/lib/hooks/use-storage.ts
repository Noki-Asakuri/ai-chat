import { api } from "@/convex/_generated/api";

import { getConvexReactClient } from "../convex/client";

const convexClient = getConvexReactClient();

export function useStorage() {
  async function uploadFile({ file }: { file: File }) {
    const { url, key } = await convexClient.mutation(api.files.generateUserUploadUrl, {});

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

  async function deleteFile(key: string) {
    await convexClient.mutation(api.files.deleteObject, { key });
  }

  return { uploadFile, deleteFile };
}
