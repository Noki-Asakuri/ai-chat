import type { Doc, Id } from "@ai-chat/backend/convex/_generated/dataModel";

import type { EditMessage } from "../store/chat-store";
import { isPastFileReadableBy } from "./composer-tokens";
import type { SentAttachment } from "./shared";

type EditAttachments = Pick<EditMessage, "currentAttachments" | "keptAttachmentIds">;
type SavedFile = Pick<Doc<"attachments">, "_id" | "name" | "size" | "mimeType" | "path">;

/**
 * Whether a chip's file goes with the edit: one of the message's own files while it is kept in the
 * edit's tray, and another past file while the edit's model can read it.
 */
export function isEditFileAttached(
  editMessage: EditAttachments & Pick<EditMessage, "model">,
  attachmentId: string,
): boolean {
  if (!isOwnFile(editMessage, attachmentId)) return isPastFileReadableBy(editMessage.model, attachmentId);
  return isKeptOrNotOwn(editMessage, attachmentId);
}

function isOwnFile(editMessage: EditAttachments, attachmentId: string): boolean {
  return editMessage.currentAttachments.some((attachment) => attachment._id === attachmentId);
}

// The message's own files go only while kept; any other file isn't held back by the tray.
function isKeptOrNotOwn(editMessage: EditAttachments, attachmentId: string): boolean {
  return (
    !isOwnFile(editMessage, attachmentId) || editMessage.keptAttachmentIds.some((id) => id === attachmentId)
  );
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
    // Saving already left out files the model can't read.
    if (isKeptOrNotOwn(editMessage, attachment._id))
      sentById.set(attachment._id, toSentAttachment(attachment));
  }
  for (const item of uploaded) sentById.set(item.attachmentId, item);

  return [...sentById.values()];
}

function toSentAttachment(attachment: SavedFile): SentAttachment {
  const { _id, name, size, mimeType, path } = attachment;
  return { attachmentId: _id, name, size, mimeType, path };
}
