import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { getConvexReactClient } from "../convex/client";
import { uploadFileToR2 } from "../convex/uploadFiles";
import type { ChatMessage, UIChatMessage, UserAttachment } from "../types";

export function convertToUIChatMessages(messages: ChatMessage[]): UIChatMessage[] {
  return messages.map(
    (message): UIChatMessage => ({
      id: message.messageId,
      role: message.role,
      parts: message.parts as UIChatMessage["parts"],
      metadata: message.metadata,
    }),
  );
}

type UploadedAttachment = {
  attachmentId: Id<"attachments">;
  path: string;
  mediaType: string;
};

export function uploadUserAttachment(
  attachments: UserAttachment[],
  threadId: Id<"threads">,
  sessionId: string,
): Promise<UploadedAttachment[]> {
  const uploadPromises: Promise<UploadedAttachment>[] = [];
  const convexClient = getConvexReactClient();

  async function createAttachmentAndUploadToR2(
    attachment: UserAttachment,
  ): Promise<UploadedAttachment> {
    const createAttachmentPromise = convexClient.mutation(
      api.functions.attachments.createAttachment,
      {
        id: attachment.id,
        name: attachment.file.name,
        size: attachment.file.size,
        mimeType: attachment.file.type,
        threadId: threadId,
        sessionId: sessionId,
        source: "user",
        type: attachment.type,
      },
    );

    const uploadFilePromise = uploadFileToR2(attachment.file, {
      fileId: attachment.id,
      threadId,
      sessionId,
    });

    const [{ docId }, filePath] = await Promise.all([createAttachmentPromise, uploadFilePromise]);
    return { attachmentId: docId, path: filePath, mediaType: attachment.file.type };
  }

  for (const attachment of attachments) {
    uploadPromises.push(createAttachmentAndUploadToR2(attachment));
  }

  return Promise.all(uploadPromises);
}
