import { api } from "@/convex/_generated/api";

import { useSessionId } from "convex-helpers/react/sessions";

import { getConvexReactClient } from "../convex/client";
import { tryCatch } from "../utils";

const convexClient = getConvexReactClient();

export function useStorage() {
  const [sessionId] = useSessionId() as readonly [string, () => void, Promise<string>];

  async function uploadFile({ file }: { file: File }) {
    const { url, key } = await convexClient.mutation(api.functions.files.generateUserUploadUrl, {
      sessionId,
    });

    const [, error] = await tryCatch(async () => {
      const result = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!result.ok) throw new Error(`Failed to upload image: ${result.statusText}`);
    });

    if (error) throw error;

    await convexClient.mutation(api.functions.files.syncMetadata, { key });
    return key;
  }

  async function uploadAvatarFile({ file }: { file: File }) {
    const { url, key } = await convexClient.mutation(
      api.functions.files.generateUserAvatarUploadUrl,
      {
        sessionId,
        mimeType: file.type,
      },
    );

    const [, error] = await tryCatch(async () => {
      const result = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!result.ok) throw new Error(`Failed to upload avatar: ${result.statusText}`);
    });

    if (error) throw error;

    await convexClient.mutation(api.functions.files.syncMetadata, { key });
    return key;
  }

  async function deleteFile(key: string) {
    await convexClient.mutation(api.functions.files.deleteFile, { key, sessionId });
  }

  return { uploadFile, uploadAvatarFile, deleteFile };
}
