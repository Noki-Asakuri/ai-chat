export type RequestValidationErrorCode = "MODEL_DEPRECATED";

export type DeprecatedModelErrorDetails = {
  modelId: string;
  modelName: string;
  replacementModelId: string;
  replacementModelName: string;
};

export class RequestValidationError extends Error {
  readonly code: RequestValidationErrorCode;
  readonly details: DeprecatedModelErrorDetails;

  constructor(options: {
    code: RequestValidationErrorCode;
    message: string;
    details: DeprecatedModelErrorDetails;
  }) {
    super(options.message);
    this.name = "RequestValidationError";
    this.code = options.code;
    this.details = options.details;
  }
}
