import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";
import { getFileInputModality, resolveReasoning } from "@ai-chat/shared/chat/models";
import {
  chatModelParamsSchema,
  chatRequestBodySchema,
  type ChatRequestBody,
} from "@ai-chat/shared/chat/request";

import { Result } from "better-result";
import type { JSONValue } from "hono/utils/types";
import { z } from "zod/v4";

import { MessagesValidationError, RequestBodySchemaError, type ChatRequestValidationError } from "./errors";
import { convertMessages, moveAssistantFilePartsToNextUserMessage, validateMessages } from "./messages";
import { resolveRequestedModel, validateModelAvailability } from "./model";
import { buildProviderOptions, buildTools } from "./provider-options";
import type { ValidatedChatRequestBody } from "./types";

import type { ChatModelParams } from "../types";

const convexChatRequestBodySchema = chatRequestBodySchema.extend({
  assistantMessageId: z.string().min(1).pipe(z.custom<Id<"messages">>()),
  retryAttemptId: z.string().min(1).pipe(z.custom<Id<"retryAttempts">>()).optional(),
  threadId: z.string().min(1).pipe(z.custom<Id<"threads">>()),
  modelParams: chatModelParamsSchema.extend({
    profile: z.string().pipe(z.custom<Id<"profiles">>()).nullish().default(null),
  }),
});

function parseChatRequestBody(body: JSONValue) {
  const parsed = convexChatRequestBodySchema.safeParse(body);
  if (parsed.success) return Result.ok(parsed.data);

  return Result.err(
    new RequestBodySchemaError({ cause: parsed.error, message: z.prettifyError(parsed.error) }),
  );
}

async function validateRequestBody(
  body: JSONValue,
): Promise<Result<ValidatedChatRequestBody, ChatRequestValidationError>> {
  const result = await Result.gen(async function* () {
    const data = yield* parseChatRequestBody(body);

    const model = yield* resolveRequestedModel(data.model);
    const availableModel = yield* validateModelAvailability(model);

    const messages = yield* Result.await(validateMessages(data.messages));
    const unsupportedFilePart = messages
      .flatMap((message) => message.parts)
      .find((part) => {
        if (part.type !== "file") return false;

        const modality = getFileInputModality(part.mediaType);
        return modality === null || !availableModel.data.modalities.input.includes(modality);
      });

    if (unsupportedFilePart?.type === "file") {
      return Result.err(
        new MessagesValidationError({
          cause: unsupportedFilePart,
          message: `Model ${availableModel.requestedId} does not support ${unsupportedFilePart.mediaType} input`,
        }),
      );
    }

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
  const reasoning = resolveReasoning(modelInfo, data.modelParams.effort);
  const sdkReasoning =
    modelInfo.provider === "kimi" ||
    modelInfo.provider === "zai" ||
    reasoning === "max" ||
    modelInfo.capabilities.reasoning?.type !== "selectable"
      ? undefined
      : reasoning;
  const providerOptions = buildProviderOptions(modelInfo, reasoning);
  const modelParams: ChatModelParams = {
    ...data.modelParams,
    effort: reasoning,
  };

  return Result.ok({
    messages,
    modelMessages,

    threadId: data.threadId,
    assistantMessageId: data.assistantMessageId,
    retryAttemptId: data.retryAttemptId,

    tools,
    providerOptions,
    reasoning,
    sdkReasoning,
    modelParams,
    model: { id: modelInfo.id, uniqueId: requestedId },
  });
}

type ValidationErrorResponse = {
  message: string;
  status: 400 | 409;
};

function getValidationErrorResponse(error: ChatRequestValidationError): ValidationErrorResponse {
  switch (error._tag) {
    case "DeprecatedModelError":
      return {
        message: `This model is no longer available. Please switch to ${error.details.replacementModelName} and try again.`,
        status: 409,
      };
    case "MessagesValidationError":
      return {
        message: "The chat messages could not be read. Please refresh the page and try again.",
        status: 400,
      };
    case "MissingModelError":
      return {
        message: "Please choose a model before sending a message.",
        status: 400,
      };
    case "ModelMessagesConversionError":
      return {
        message: "The chat history could not be prepared. Please refresh the page and try again.",
        status: 400,
      };
    case "RequestBodySchemaError":
      return {
        message: "The chat request was invalid. Please refresh the page and try again.",
        status: 400,
      };
    case "UnknownModelError":
      return {
        message: "The selected model is not available. Please choose another model and try again.",
        status: 400,
      };
    default:
      throw new Error("Unhandled validation error");
  }
}

export { getValidationErrorResponse, validateRequestBody, type ChatRequestBody };
