import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { useConvex } from "convex/react";
import { toast } from "sonner";

import { useNavigate, useParams } from "@tanstack/react-router";
import { useShallow } from "zustand/shallow";

import { useConfigStore, useConfigStoreState } from "@/components/provider/config-provider";

import { buildAttachmentUrl } from "@/lib/assets/urls";
import { emitStreamFeedback } from "@/lib/chat/stream-feedback";
import { setStickyToBottom } from "@/lib/chat/scroll-stickiness";
import { chatStoreActions, useChatStore } from "@/lib/store/chat-store";
import { messageStoreActions, useMessageStore } from "@/lib/store/messages-store";
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

const SELECTED_BLOCKQUOTE_FOCUS_INSTRUCTION =
  "Instruction: The quoted blockquote in the user message is selected context from an assistant response. Focus your answer on that blockquote and treat the remaining text as the user's follow-up.";

function formatSelectedTextBlockquote(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => `> ${line}`)
    .join("\n");
}

function buildInputWithBlockquoteInstruction({
  input,
  selectedBlockquoteContext,
}: {
  input: string;
  selectedBlockquoteContext: { text: string } | null;
}): string {
  if (!selectedBlockquoteContext) return input;
  if (!input.includes(formatSelectedTextBlockquote(selectedBlockquoteContext.text))) return input;

  return `${SELECTED_BLOCKQUOTE_FOCUS_INSTRUCTION}\n\n${input}`;
}

export function useSendChatMessage() {
  const navigate = useNavigate();
  const configStore = useConfigStoreState();
  const params = useParams({ from: "/_chat/threads/$threadId", shouldThrow: false });

  const convexClient = useConvex();
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

    const { input, attachments, selectedBlockquoteContext } = useChatStore.getState();
    const messageState = useMessageStore.getState();

    const messagesHistory = messageState.messageIds
      .map((id) => messageState.messagesById[id]!)
      .sort((a, b) => a.createdAt - b.createdAt);

    const lastMessage = messagesHistory[messagesHistory.length - 1];

    if (!input || lastMessage?.status === "pending" || lastMessage?.status === "streaming") return;
    const inputForRequest = buildInputWithBlockquoteInstruction({ input, selectedBlockquoteContext });
    chatStoreActions.resetInput();

    if (!threadId) {
      threadId = await convexClient.mutation(api.functions.threads.createThread, {
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
    if (typeof window !== "undefined") {
      setStickyToBottom(true);
      window.dispatchEvent(new Event("chat:force-scroll-bottom"));
    }

    messageStoreActions.setController(threadId, {
      controller: abortController,
      assistantMessageId,
    });

    const messages = convertToUIChatMessages(messagesHistory);
    const uploadedAttachments = await uploadUserAttachment(attachments, threadId);
    const userMessageRequestParts: UIChatMessage["parts"] = [{ type: "text", text: inputForRequest }];
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

      await processStreamResponse(response, assistantMessageId, threadId);
      emitStreamFeedback({
        status: "success",
        threadId,
        soundEnabled: notificationSound,
        desktopEnabled: desktopNotification,
      });
    } catch (error) {
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
        toast.error("Selected model is deprecated", {
          description: deprecatedModelError.message,
          action: {
            label: `Switch to ${deprecatedModelError.replacementModelName}`,
            onClick: () => {
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
    } finally {
      messageStoreActions.removeController(threadId);
    }
  }

  return { sendChatRequest };
}
