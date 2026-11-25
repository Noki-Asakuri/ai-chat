import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Doc, Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { useSessionId } from "convex-helpers/react/sessions";
import { useConvex, useMutation } from "convex/react";
import * as React from "react";

import { parseComposerInput, resolveComposerAttachments } from "@/lib/chat/composer-tokens";
import { tryGetModelData } from "@/lib/chat/models";
import { useRetryTurn } from "@/lib/chat/server-function/retry-turn";
import { buildUserMessageParts, type SentAttachment, uploadUserAttachment } from "@/lib/chat/shared";
import { chatStoreActions, useChatStore } from "@/lib/store/chat-store";
import { useMessageStore } from "@/lib/store/messages-store";

function toSentAttachment(attachment: Doc<"attachments">): SentAttachment {
  const { _id, name, size, mimeType, path } = attachment;
  return { attachmentId: _id, name, size, mimeType, path };
}

export function useChatEditSave() {
  const { retryTurn } = useRetryTurn();
  const deleteAttachments = useMutation(api.functions.attachments.deleteAttachments);
  const [sessionId] = useSessionId();
  const convexClient = useConvex();
  const [isSaving, startSaving] = React.useTransition();

  function saveEdits() {
    if (isSaving) return;

    const editMessage = useChatStore.getState().editMessage;
    const threadId = useMessageStore.getState().currentThreadId;

    if (!editMessage || !sessionId || !threadId) return;

    const { displayText, attachmentIds: referencedIds } = parseComposerInput(editMessage.input);

    startSaving(async () => {
      const acceptedInputs = tryGetModelData(editMessage.model)?.modalities.input ?? [];
      // A chip for one of the message's own files sends it only while it is kept in the tray.
      const currentIds = new Set<string>(editMessage.currentAttachments.map((attachment) => attachment._id));
      const newReferenced = await resolveComposerAttachments(
        convexClient,
        referencedIds.filter((id) => !currentIds.has(id)),
      );
      const uploaded = await uploadUserAttachment(editMessage.attachments, threadId);

      const sentById = new Map<Id<"attachments">, SentAttachment>();
      for (const attachmentId of editMessage.keptAttachmentIds) {
        const attachment = editMessage.currentAttachments.find((item) => item._id === attachmentId);
        if (attachment) sentById.set(attachmentId, toSentAttachment(attachment));
      }
      for (const attachment of newReferenced) {
        if (acceptedInputs.includes(attachment.type))
          sentById.set(attachment._id, toSentAttachment(attachment));
      }
      for (const item of uploaded) sentById.set(item.attachmentId, item);

      const sentAttachments = [...sentById.values()];
      const { displayParts, requestParts } = buildUserMessageParts(displayText, sentAttachments);

      const result = await retryTurn({
        userMessageId: editMessage._id,
        modelId: editMessage.model,
        modelParams: editMessage.modelParams,
        onPrepared: () => chatStoreActions.setEditMessage(null),

        userMessage: {
          messageId: editMessage._id,
          parts: displayParts,
          attachments: [...sentById.keys()],
          requestParts,
        },
      });

      if (result.status === "started" || (result.status === "failed" && result.phase === "stream")) return;

      if (uploaded.length > 0) {
        try {
          await deleteAttachments({ attachmentIds: uploaded.map((attachment) => attachment.attachmentId) });
        } catch (error) {
          console.error("[Chat] Failed to clean up attachments after retry preparation", error);
        }
      }
    });
  }

  return { isSaving, saveEdits };
}
