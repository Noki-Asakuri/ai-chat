import { api } from "@/convex/_generated/api";

import { getConvexReactClient } from "../convex/client";

const convexClient = getConvexReactClient();

export function useStorage() {
  async function uploadFile({ file }: { file: File }) {
    const { url, key } = await convexClient.mutation(api.functions.files.generateUserUploadUrl, {});

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

  async function deleteFile(key: string) {
    await convexClient.mutation(api.functions.files.deleteFile, { key });
  }

  return { uploadFile, deleteFile };
}
