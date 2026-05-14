import { TaggedError } from "better-result";
import type { z } from "zod/v4";

export type DeprecatedModelErrorDetails = {
  modelId: string;
  modelName: string;
  replacementModelId: string;
  replacementModelName: string;
};

export class RequestBodySchemaError extends TaggedError("RequestBodySchemaError")<{
  message: string;
  cause: z.ZodError;
}>() {}

export class MessagesValidationError extends TaggedError("MessagesValidationError")<{
  message: string;
  cause: unknown;
}>() {}

export class MissingModelError extends TaggedError("MissingModelError")<{
  message: string;
}>() {}

export class UnknownModelError extends TaggedError("UnknownModelError")<{
  message: string;
  modelId: string;
}>() {}

export class DeprecatedModelError extends TaggedError("DeprecatedModelError")<{
  code: "MODEL_DEPRECATED";
  message: string;
  details: DeprecatedModelErrorDetails;
}>() {}

export class ModelMessagesConversionError extends TaggedError("ModelMessagesConversionError")<{
  message: string;
  cause: unknown;
}>() {}

export type ChatRequestValidationError =
  | RequestBodySchemaError
  | MessagesValidationError
  | MissingModelError
  | UnknownModelError
  | DeprecatedModelError
  | ModelMessagesConversionError;
