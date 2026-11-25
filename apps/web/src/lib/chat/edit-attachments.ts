import type { Doc, Id } from "@ai-chat/backend/convex/_generated/dataModel";

import type { EditMessage } from "../store/chat-store";
import type { SentAttachment } from "./shared";

type EditAttachments = Pick<EditMessage, "currentAttachments" | "keptAttachmentIds">;
type SavedFile = Pick<Doc<"attachments">, "_id" | "name" | "size" | "mimeType" | "path">;

/** One of the message's own files counts as attached only while it is kept in the edit's tray. */
export function isEditFileAttached(editMessage: EditAttachments, attachmentId: string): boolean {
  const isOwnFile = editMessage.currentAttachments.some((attachment) => attachment._id === attachmentId);
  return !isOwnFile || editMessage.keptAttachmentIds.some((id) => id === attachmentId);
}

/**
 * The files an edit is saved with: the message's own files still kept, other saved files its chips
 * point at, then the files added in the edit. The message's own files are never sent just because a
 * chip for them is in the text.
 */
export function getEditSentAttachments(
  editMessage: EditAttachments,
  referenced: ReadonlyArray<SavedFile>,
  uploaded: ReadonlyArray<SentAttachment>,
): SentAttachment[] {
  const sentById = new Map<Id<"attachments">, SentAttachment>();

  for (const attachmentId of editMessage.keptAttachmentIds) {
    const attachment = editMessage.currentAttachments.find((item) => item._id === attachmentId);
    if (attachment) sentById.set(attachmentId, toSentAttachment(attachment));
  }
  for (const attachment of referenced) {
    if (isEditFileAttached(editMessage, attachment._id))
      sentById.set(attachment._id, toSentAttachment(attachment));
  }
  for (const item of uploaded) sentById.set(item.attachmentId, item);

  return [...sentById.values()];
}

function toSentAttachment(attachment: SavedFile): SentAttachment {
  const { _id, name, size, mimeType, path } = attachment;
  return { attachmentId: _id, name, size, mimeType, path };
}
