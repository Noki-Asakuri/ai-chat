import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { useConvex } from "convex/react";
import { toast } from "@/components/ui/toast";

import { useNavigate, useParams } from "@tanstack/react-router";
import { useShallow } from "zustand/shallow";

import { useConfigStore, useConfigStoreState } from "@/components/provider/config-provider";

import { buildAttachmentUrl } from "@/lib/assets/urls";
import { parseComposerInput, resolveComposerAttachments } from "@/lib/chat/composer-tokens";
import { tryGetModelData } from "@/lib/chat/models";
import { emitStreamFeedback } from "@/lib/chat/stream-feedback";
import { setStickyToBottom } from "@/lib/chat/scroll-stickiness";
import { chatStoreActions, useChatStore } from "@/lib/store/chat-store";
import { messageStoreActions, useMessageStore } from "@/lib/store/messages-store";
import { useThreadStore } from "@/lib/store/thread-store";
import type { ChatRequestBody, UIChatMessage } from "@/lib/types";
import { fromUUID, toUUID, tryCatch } from "@/lib/utils";

import { convertToUIChatMessages, processStreamResponse, uploadUserAttachment } from "../shared";
import {
  getClientErrorMessage,
  getDeprecatedModelError,
  isAbortError,
  throwIfChatResponseError,
} from "./chat-errors";
import { useSyncThreadModelConfig } from "./sync-thread-model-config";

type CreateMessage = (typeof api.functions.messages.addMessagesToThread)["_args"]["messages"][number];
type MessageParts = CreateMessage["parts"];

export function useSendChatMessage() {
  const navigate = useNavigate();
  const configStore = useConfigStoreState();
  const params = useParams({ from: "/_chat/threads/$threadId", shouldThrow: false });

  const convexClient = useConvex();
  const { syncThreadModelConfig } = useSyncThreadModelConfig();
  const { modelParams, model, notificationSound, desktopNotification } = useConfigStore(
    useShallow((state) => ({
      model: state.model,
      modelParams: state.modelParams,
      notificationSound: state.notificationSound,
      desktopNotification: state.desktopNotification,
    })),
  );

  async function sendChatRequest() {
    let threadId: Id<"threads"> | null = fromUUID<Id<"threads">>(params?.threadId) ?? null;

    const { input: composerInput, attachments } = useChatStore.getState();
    const {
      text: input,
      displayText,
      profileId,
      profileLabel,
      attachmentIds: pastAttachmentIds,
    } = parseComposerInput(composerInput);
    const messageState = useMessageStore.getState();

    const messagesHistory = messageState.messageIds
      .map((id) => messageState.messagesById[id]!)
      .toSorted((a, b) => a.createdAt - b.createdAt);

    const lastMessage = messagesHistory[messagesHistory.length - 1];

    if (lastMessage?.status === "pending" || lastMessage?.status === "streaming") return;

    if (profileId && profileId !== modelParams.profile) {
      configStore.setModelParams({ profile: profileId });
      if (threadId) void syncThreadModelConfig({ threadId, modelParams: { profile: profileId } });
    }

    // A message can be just attachments, with no text.
    const hasAttachments = attachments.length > 0 || pastAttachmentIds.length > 0;

    if (!input && !hasAttachments) {
      if (!profileId) return;

      chatStoreActions.setInput("");
      toast.success(`Using ${profileLabel ?? "profile"} for this thread`);
      return;
    }

    chatStoreActions.resetInput();

    const requestModelParams = { ...modelParams, profile: profileId ?? modelParams.profile };
    const acceptedInputs = tryGetModelData(model)?.modalities.input ?? [];
    const [pastAttachments, pastAttachmentsError] = await tryCatch(
      resolveComposerAttachments(convexClient, pastAttachmentIds),
    );
    if (pastAttachmentsError) {
      console.error("[Chat] Failed to resolve referenced attachments", pastAttachmentsError);
      toast.error("Couldn't attach referenced files", { description: pastAttachmentsError.message });
    }
    const referencedAttachments = (pastAttachments ?? []).filter((attachment) =>
      acceptedInputs.includes(attachment.type),
    );

    if (!threadId) {
      threadId = await convexClient.mutation(api.functions.threads.createThread, {
        groupId: useThreadStore.getState().activeGroupId,
        latestModel: model,
        latestModelParams: requestModelParams,
      });

      await navigate({ to: "/threads/$threadId", params: { threadId: toUUID(threadId) } });
    }

    const abortController = new AbortController();
    let assistantMessageId: Id<"messages"> | null = null;

    const userMessage: CreateMessage = {
      messageId: crypto.randomUUID(),
      role: "user",
      status: "complete",
      parts: displayText ? [{ type: "text", text: displayText, state: "done" }] : [],
      attachments: [],
    };

    const assistantMessage: CreateMessage = {
      messageId: crypto.randomUUID(),
      role: "assistant",
      status: "pending",
      parts: [],
      attachments: [],
      metadata: {
        model: { request: model, response: null },
        finishReason: null,
        timeToFirstTokenMs: 0,
        usages: { inputTokens: 0, outputTokens: 0, reasoningTokens: 0 },
        durations: { request: 0, reasoning: 0, text: 0 },
        modelParams: requestModelParams,
      },
    };

    assistantMessageId = await convexClient.mutation(api.functions.messages.addMessagesToThread, {
      threadId,
      messages: [userMessage, assistantMessage],
    });

    // Sending a new message is explicit intent to follow the latest response.
    if ("window" in globalThis) {
      setStickyToBottom(true);
      window.dispatchEvent(new Event("chat:force-scroll-bottom"));
    }

    messageStoreActions.setController(threadId, {
      controller: abortController,
      assistantMessageId,
    });

    const messages = convertToUIChatMessages(messagesHistory);
    const uploadedAttachments = await uploadUserAttachment(attachments, threadId);
    // Providers reject empty text blocks, so an attachment-only message carries just its files.
    const userMessageRequestParts: UIChatMessage["parts"] = input ? [{ type: "text", text: input }] : [];
    const userMessageDisplayParts: MessageParts = displayText ? [{ type: "text", text: displayText }] : [];

    messages.push({
      role: "user",
      id: userMessage.messageId,
      parts: userMessageRequestParts,
    });

    const linkedAttachments = [
      ...referencedAttachments.map((attachment) => ({
        attachmentId: attachment._id,
        path: attachment.path,
        mediaType: attachment.mimeType,
      })),
      ...uploadedAttachments,
    ];

    if (linkedAttachments.length > 0) {
      const attachmentIds = linkedAttachments.map((a) => a.attachmentId);

      for (const { path, mediaType } of linkedAttachments) {
        const url = buildAttachmentUrl(path, mediaType);

        messages[messages.length - 1]!.parts.push({ type: "file", url, mediaType });
        userMessageDisplayParts.push({ type: "file", url, mediaType });
      }

      await convexClient.mutation(api.functions.messages.addAttachmentsToMessage, {
        messageId: userMessage.messageId,
        parts: userMessageDisplayParts,
        attachmentIds,
      });
    }

    try {
      const body: ChatRequestBody = {
        model,
        threadId,
        messages,
        assistantMessageId,
        modelParams: requestModelParams,
      };

      const response = await fetch(new URL("/api/ai/chat", import.meta.env.VITE_API_ENDPOINT), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: abortController.signal,
      });

      await throwIfChatResponseError(response);

      const responseStreamId = response.headers.get("X-Stream-Id");
      if (responseStreamId) {
        messageStoreActions.setController(threadId, {
          controller: abortController,
          assistantMessageId,
          streamId: responseStreamId,
        });
      }

      await processStreamResponse(response, assistantMessageId, threadId, abortController);
      emitStreamFeedback({
        status: "success",
        threadId,
        soundEnabled: notificationSound,
        desktopEnabled: desktopNotification,
      });
    } catch (error) {
      messageStoreActions.removeController(threadId, abortController);
      if (isAbortError(error)) return;

      const errorMessage = getClientErrorMessage(error);
      const deprecatedModelError = getDeprecatedModelError(error);

      emitStreamFeedback({
        status: "error",
        threadId,
        soundEnabled: notificationSound,
        desktopEnabled: desktopNotification,
        errorMessage,
      });

      if (assistantMessageId) {
        const [, updateError] = await tryCatch(
          convexClient.mutation(api.functions.messages.updateErrorMessage, {
            messageId: assistantMessageId,
            error: errorMessage,
            metadata: {
              model: { request: model, response: null },
              modelParams: requestModelParams,
            },
          }),
        );

        if (updateError) {
          console.error("[Chat] Failed to persist request error", updateError);
        }
      }

      if (deprecatedModelError) {
        toast.error("Selected model is deprecated", {
          description: deprecatedModelError.message,
          actionProps: {
            children: `Switch to ${deprecatedModelError.replacementModelName}`,
            onClick: () => {
              chatStoreActions.retainCompatibleAttachments(deprecatedModelError.replacementModelId);
              configStore.setConfig({
                model: deprecatedModelError.replacementModelId,
                defaultModel: deprecatedModelError.replacementModelId,
              });
            },
          },
        });
        return;
      }

      toast.error("Failed to send message", { description: errorMessage });
      return;
    }

    messageStoreActions.removeController(threadId, abortController);
  }

  return { sendChatRequest };
}
