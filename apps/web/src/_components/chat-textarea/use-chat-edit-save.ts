import { api } from "@ai-chat/backend/convex/_generated/api";

import { useSessionId } from "convex-helpers/react/sessions";
import { useConvex, useMutation } from "convex/react";
import * as React from "react";

import { parseComposerInput, resolveComposerAttachments } from "@/lib/chat/composer-tokens";
import { tryGetModelData } from "@/lib/chat/models";
import { useRetryTurn } from "@/lib/chat/server-function/retry-turn";
import { getEditSentAttachments } from "@/lib/chat/edit-attachments";
import { buildUserMessageParts, uploadUserAttachment } from "@/lib/chat/shared";
import { chatStoreActions, useChatStore } from "@/lib/store/chat-store";
import { useMessageStore } from "@/lib/store/messages-store";

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
      // Chips for the message's own files need no lookup; whether they're sent depends on the tray.
      const currentIds = new Set<string>(editMessage.currentAttachments.map((attachment) => attachment._id));
      const referenced = await resolveComposerAttachments(
        convexClient,
        referencedIds.filter((id) => !currentIds.has(id)),
      );
      const uploaded = await uploadUserAttachment(editMessage.attachments, threadId);

      const sentAttachments = getEditSentAttachments(
        editMessage,
        referenced.filter((attachment) => acceptedInputs.includes(attachment.type)),
        uploaded,
      );
      const { displayParts, requestParts } = buildUserMessageParts(displayText, sentAttachments);

      const result = await retryTurn({
        userMessageId: editMessage._id,
        modelId: editMessage.model,
        modelParams: editMessage.modelParams,
        onPrepared: () => chatStoreActions.setEditMessage(null),

        userMessage: {
          messageId: editMessage._id,
          parts: displayParts,
          attachments: sentAttachments.map((attachment) => attachment.attachmentId),
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
