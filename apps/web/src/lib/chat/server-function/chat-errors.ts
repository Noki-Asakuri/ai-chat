import { z } from "zod/v4";

const GENERIC_CLIENT_ERROR = "Failed to process your request. Please try again.";

type DeprecatedModelError = {
  message: string;
  modelId: string;
  modelName: string;
  replacementModelId: string;
  replacementModelName: string;
};

type ChatApiErrorOptions = {
  message: string;
  status: number;
  code?: string | null;
  details?: DeprecatedModelDetails | null;
};

type DeprecatedModelDetails = {
  modelId: string;
  modelName?: string;
  replacementModelId: string;
  replacementModelName?: string;
};

const chatErrorResponseSchema = z.object({
  error: z.object({
    message: z.string().optional(),
    code: z.string().nullable().optional(),
    details: z
      .object({
        modelId: z.string(),
        modelName: z.string().optional(),
        replacementModelId: z.string(),
        replacementModelName: z.string().optional(),
      })
      .nullable()
      .optional(),
  }),
});

export class ChatApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly details: DeprecatedModelDetails | null;

  constructor(options: ChatApiErrorOptions) {
    super(options.message);
    this.name = "ChatApiError";
    this.status = options.status;
    this.code = options.code ?? null;
    this.details = options.details ?? null;
  }
}

export function isAbortError(cause: unknown): boolean {
  return cause instanceof DOMException && cause.name === "AbortError";
}

export async function throwIfChatResponseError(response: Response): Promise<void> {
  if (response.ok) return;

  let message = response.statusText.trim();
  if (message.length === 0) {
    message = `Request failed with status ${response.status}.`;
  }

  let code: string | null = null;
  let details: DeprecatedModelDetails | null = null;

  try {
    const result = chatErrorResponseSchema.safeParse(await response.clone().json());
    if (result.success) {
      const errorPayload = result.data.error;
      if (errorPayload.message) message = errorPayload.message;
      code = errorPayload.code ?? null;
      details = errorPayload.details ?? null;
    }
  } catch {
    // no-op
  }

  throw new ChatApiError({ message, status: response.status, code, details });
}

export function getDeprecatedModelError(cause: unknown): DeprecatedModelError | null {
  if (!(cause instanceof ChatApiError)) return null;
  if (cause.code !== "MODEL_DEPRECATED") return null;

  const details = cause.details;
  if (!details) return null;

  const modelId = details.modelId;
  const replacementModelId = details.replacementModelId;

  return {
    message: cause.message,
    modelId,
    modelName: details.modelName ?? modelId,
    replacementModelId,
    replacementModelName: details.replacementModelName ?? replacementModelId,
  };
}

export function getClientErrorMessage(cause: unknown): string {
  if (cause instanceof Error) {
    const message = cause.message.trim();
    if (message.length > 0) return message;
  }

  return GENERIC_CLIENT_ERROR;
}
