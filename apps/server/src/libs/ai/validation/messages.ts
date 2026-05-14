import type { ModelMessage } from "@ai-sdk/provider-utils";

import { convertToModelMessages, validateUIMessages } from "ai";
import { Result, type Result as BetterResult } from "better-result";

import { metadataSchema, type UIChatMessage } from "@ai-chat/shared/chat/metadata";
import type { ChatRequestBody } from "@ai-chat/shared/chat/request";

import { MessagesValidationError, ModelMessagesConversionError } from "./errors";
import { getErrorMessage } from "./utils";

type AssistantFilePart = UIChatMessage["parts"][number];

export async function validateMessages(
  messages: ChatRequestBody["messages"],
): Promise<BetterResult<Array<UIChatMessage>, MessagesValidationError>> {
  return Result.tryPromise({
    try: function validateMessagesFormat() {
      return validateUIMessages<UIChatMessage>({ messages, metadataSchema });
    },
    catch: function mapMessagesValidationError(cause) {
      return new MessagesValidationError({
        cause,
        message: `Invalid messages format: ${getErrorMessage(cause)}`,
      });
    },
  });
}

export function moveAssistantFilePartsToNextUserMessage(
  messages: Array<UIChatMessage>,
): Array<UIChatMessage> {
  let output: Array<UIChatMessage> = [];

  for (let index = 0; index < messages.length; index++) {
    const message = messages[index];
    if (!message) continue;

    const previousMessage = messages[index - 1];
    const previousAssistantFileParts = getAssistantFileParts(previousMessage);
    const messageWithoutAssistantFileParts = removeAssistantFileParts(message);
    const nextParts =
      message.role === "user"
        ? [...messageWithoutAssistantFileParts.parts, ...previousAssistantFileParts]
        : messageWithoutAssistantFileParts.parts;

    output = [...output, { ...messageWithoutAssistantFileParts, parts: nextParts }];
  }

  return output;
}

function getAssistantFileParts(message: UIChatMessage | undefined): Array<AssistantFilePart> {
  if (message?.role !== "assistant") return [];

  return splitFileParts(message.parts).fileParts;
}

function removeAssistantFileParts(message: UIChatMessage): UIChatMessage {
  if (message.role !== "assistant") return message;

  return { ...message, parts: splitFileParts(message.parts).nonFileParts };
}

function splitFileParts(parts: UIChatMessage["parts"]): {
  fileParts: Array<AssistantFilePart>;
  nonFileParts: Array<AssistantFilePart>;
} {
  let fileParts: Array<AssistantFilePart> = [];
  let nonFileParts: Array<AssistantFilePart> = [];

  for (const part of parts) {
    if (part.type === "file") {
      fileParts = [...fileParts, part];
    } else {
      nonFileParts = [...nonFileParts, part];
    }
  }

  return { fileParts, nonFileParts };
}

export async function convertMessages(
  messages: Array<UIChatMessage>,
): Promise<BetterResult<Array<ModelMessage>, ModelMessagesConversionError>> {
  return Result.tryPromise({
    try: function convertMessagesToModelMessages() {
      return convertToModelMessages(messages);
    },
    catch: function mapModelMessagesConversionError(cause) {
      return new ModelMessagesConversionError({
        cause,
        message: `Could not convert messages: ${getErrorMessage(cause)}`,
      });
    },
  });
}
