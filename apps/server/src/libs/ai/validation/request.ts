import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";
import { chatRequestBodySchema, type ChatRequestBody } from "@ai-chat/shared/chat/request";

import { matchError, Result } from "better-result";
import { z } from "zod/v4";

import { RequestBodySchemaError, type ChatRequestValidationError } from "./errors";
import {
  convertMessages,
  moveAssistantFilePartsToNextUserMessage,
  validateMessages,
} from "./messages";
import { resolveRequestedModel, validateModelAvailability } from "./model";
import { buildProviderOptions, buildTools } from "./provider-options";
import type { ValidatedChatRequestBody } from "./types";

import type { ChatModelParams } from "../types";

function parseChatRequestBody(body: Record<string, unknown>) {
  const parsed = chatRequestBodySchema.safeParse(body);
  if (parsed.success) return Result.ok(parsed.data);

  return Result.err(
    new RequestBodySchemaError({ cause: parsed.error, message: z.prettifyError(parsed.error) }),
  );
}

async function validateRequestBody(
  body: Record<string, unknown>,
): Promise<Result<ValidatedChatRequestBody, ChatRequestValidationError>> {
  const result = await Result.gen(async function* () {
    const data = yield* parseChatRequestBody(body);

    const model = yield* resolveRequestedModel(data.model);
    const availableModel = yield* validateModelAvailability(model);

    const messages = yield* Result.await(validateMessages(data.messages));
    const normalizedMessages = moveAssistantFilePartsToNextUserMessage(messages);
    const modelMessages = yield* Result.await(convertMessages(normalizedMessages));

    return Result.ok({ model: availableModel, data, messages: normalizedMessages, modelMessages });
  });

  if (result.isErr()) {
    return Result.err(result.error);
  }

  const { data, model, messages, modelMessages } = result.value;
  const { data: modelInfo, requestedId } = model;

  const tools = buildTools(data, modelInfo);
  const providerOptions = buildProviderOptions({
    modelInfo,
    requestedId,
    effort: data.modelParams.effort,
  });

  return Result.ok({
    messages,
    modelMessages,

    streamId: data.streamId,
    threadId: data.threadId as Id<"threads">,
    assistantMessageId: data.assistantMessageId as Id<"messages">,

    tools,
    providerOptions,
    modelParams: data.modelParams as ChatModelParams,
    model: { id: modelInfo.id, uniqueId: requestedId },
  });
}

type ValidationErrorResponse = {
  message: string;
  status: 400 | 409;
};

function getValidationErrorResponse(error: ChatRequestValidationError): ValidationErrorResponse {
  return matchError(error, {
    DeprecatedModelError: function getDeprecatedModelMessage(deprecatedModelError) {
      return {
        message: `This model is no longer available. Please switch to ${deprecatedModelError.details.replacementModelName} and try again.`,
        status: 409,
      };
    },
    MessagesValidationError: function getMessagesValidationMessage() {
      return {
        message: "The chat messages could not be read. Please refresh the page and try again.",
        status: 400,
      };
    },
    MissingModelError: function getMissingModelMessage() {
      return {
        message: "Please choose a model before sending a message.",
        status: 400,
      };
    },
    ModelMessagesConversionError: function getModelMessagesConversionMessage() {
      return {
        message: "The chat history could not be prepared. Please refresh the page and try again.",
        status: 400,
      };
    },
    RequestBodySchemaError: function getRequestBodySchemaMessage() {
      return {
        message: "The chat request was invalid. Please refresh the page and try again.",
        status: 400,
      };
    },
    UnknownModelError: function getUnknownModelMessage() {
      return {
        message: "The selected model is not available. Please choose another model and try again.",
        status: 400,
      };
    },
  });
}

export { getValidationErrorResponse, validateRequestBody, type ChatRequestBody };
