import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Doc, Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { useSessionId } from "convex-helpers/react/sessions";
import { useMutation } from "convex/react";
import * as React from "react";

import { buildAttachmentUrl } from "@/lib/assets/urls";
import { useRetryTurn } from "@/lib/chat/server-function/retry-turn";
import { uploadUserAttachment } from "@/lib/chat/shared";
import { chatStoreActions, useChatStore } from "@/lib/store/chat-store";
import { useMessageStore } from "@/lib/store/messages-store";
import type { ChatMessage } from "@/lib/types";

export function useChatEditSave() {
  const { retryTurn } = useRetryTurn();
  const deleteAttachments = useMutation(api.functions.attachments.deleteAttachments);
  const [sessionId] = useSessionId();
  const [isSaving, startSaving] = React.useTransition();

  function saveEdits() {
    if (isSaving) return;

    const editMessage = useChatStore.getState().editMessage;
    const threadId = useMessageStore.getState().currentThreadId;

    if (!editMessage || !sessionId || !threadId) return;

    startSaving(async () => {
      const uploaded = await uploadUserAttachment(editMessage.attachments, threadId);

      const attachmentById = new Map<Id<"attachments">, Doc<"attachments">>();
      for (const attachment of editMessage.currentAttachments) {
        attachmentById.set(attachment._id, attachment);
      }

      const finalAttachmentIds: Array<Id<"attachments">> = [];
      const seenIds = new Set<Id<"attachments">>();

      for (const attachmentId of editMessage.keptAttachmentIds) {
        if (seenIds.has(attachmentId)) continue;
        seenIds.add(attachmentId);
        finalAttachmentIds.push(attachmentId);
      }

      for (const item of uploaded) {
        if (seenIds.has(item.attachmentId)) continue;
        seenIds.add(item.attachmentId);
        finalAttachmentIds.push(item.attachmentId);
      }

      const fileParts: Array<ChatMessage["parts"][number]> = [];

      for (const attachmentId of editMessage.keptAttachmentIds) {
        const attachment = attachmentById.get(attachmentId);
        if (!attachment) continue;

        const url = buildAttachmentUrl(attachment.path, attachment.mimeType);

        fileParts.push({ type: "file", url, mediaType: attachment.mimeType });
      }

      for (const item of uploaded) {
        const url = buildAttachmentUrl(item.path, item.mediaType);

        fileParts.push({ type: "file", url, mediaType: item.mediaType });
      }

      const parts: ChatMessage["parts"] = [{ type: "text", text: editMessage.input, state: "done" }];

      for (const part of fileParts) {
        parts.push(part);
      }

      const result = await retryTurn({
        userMessageId: editMessage._id,
        modelId: editMessage.model,
        modelParams: editMessage.modelParams,
        onPrepared: () => chatStoreActions.setEditMessage(null),

        userMessage: {
          messageId: editMessage._id,
          parts,
          attachments: finalAttachmentIds,
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
