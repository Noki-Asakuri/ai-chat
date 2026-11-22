import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { useConvex } from "convex/react";
import { toast } from "@/components/ui/toast";

import { useNavigate, useParams } from "@tanstack/react-router";
import { useShallow } from "zustand/shallow";

import { useConfigStore } from "@/components/provider/config-provider";

import { buildAttachmentUrl } from "@/lib/assets/urls";
import { saveThreadModelConfig, useComposerModelConfig } from "@/lib/chat/composer-model-config";
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

type CreateMessage = (typeof api.functions.messages.addMessagesToThread)["_args"]["messages"][number];
type MessageParts = CreateMessage["parts"];

export function useSendChatMessage() {
  const navigate = useNavigate();
  const params = useParams({ from: "/_chat/threads/$threadId", shouldThrow: false });

  const convexClient = useConvex();
  const composerModelConfig = useComposerModelConfig();
  const { notificationSound, desktopNotification } = useConfigStore(
    useShallow((state) => ({
      notificationSound: state.notificationSound,
      desktopNotification: state.desktopNotification,
    })),
  );

  async function sendChatRequest() {
    let threadId: Id<"threads"> | null = fromUUID<Id<"threads">>(params?.threadId) ?? null;

    const { input, attachments } = useChatStore.getState();
    const messageState = useMessageStore.getState();

    const messagesHistory = messageState.messageIds
      .map((id) => messageState.messagesById[id]!)
      .toSorted((a, b) => a.createdAt - b.createdAt);

    const lastMessage = messagesHistory[messagesHistory.length - 1];

    if (!input || lastMessage?.status === "pending" || lastMessage?.status === "streaming") return;
    chatStoreActions.resetInput();

    // Read the settings now rather than from the last render: a change made just before sending is
    // already in Convex's local cache (or the welcome page's store) but may not have rendered yet.
    const { model, modelParams } = composerModelConfig.read();

    if (!threadId) {
      threadId = await convexClient.mutation(api.functions.threads.createThread, {
        groupId: useThreadStore.getState().activeGroupId,
        latestModel: model,
        latestModelParams: modelParams,
      });

      await navigate({ to: "/threads/$threadId", params: { threadId: toUUID(threadId) } });
    }

    const abortController = new AbortController();
    let assistantMessageId: Id<"messages"> | null = null;

    const userMessage: CreateMessage = {
      messageId: crypto.randomUUID(),
      role: "user",
      status: "complete",
      parts: [{ type: "text", text: input, state: "done" }],
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
        modelParams: modelParams,
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
    const userMessageRequestParts: UIChatMessage["parts"] = [{ type: "text", text: input }];
    const userMessageDisplayParts: MessageParts = [{ type: "text", text: input }];

    messages.push({
      role: "user",
      id: userMessage.messageId,
      parts: userMessageRequestParts,
    });

    if (uploadedAttachments.length > 0) {
      const attachmentIds = uploadedAttachments.map((a) => a.attachmentId);

      for (const { path, mediaType } of uploadedAttachments) {
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
        modelParams: modelParams,
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
              modelParams: modelParams,
            },
          }),
        );

        if (updateError) {
          console.error("[Chat] Failed to persist request error", updateError);
        }
      }

      if (deprecatedModelError) {
        const failedThreadId = threadId;
        toast.error("Selected model is deprecated", {
          description: deprecatedModelError.message,
          actionProps: {
            children: `Switch to ${deprecatedModelError.replacementModelName}`,
            onClick: () => {
              chatStoreActions.retainCompatibleAttachments(deprecatedModelError.replacementModelId);
              void saveThreadModelConfig(convexClient, failedThreadId, {
                model: deprecatedModelError.replacementModelId,
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
