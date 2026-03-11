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
  details?: Record<string, unknown> | null;
};

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

export class ChatApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly details: Record<string, unknown> | null;

  constructor(options: ChatApiErrorOptions) {
    super(options.message);
    this.name = "ChatApiError";
    this.status = options.status;
    this.code = options.code ?? null;
    this.details = options.details ?? null;
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export async function throwIfChatResponseError(response: Response): Promise<void> {
  if (response.ok) return;

  let message = response.statusText.trim();
  if (message.length === 0) {
    message = `Request failed with status ${response.status}.`;
  }

  let code: string | null = null;
  let details: Record<string, unknown> | null = null;

  try {
    const payload = await response.clone().json();
    if (isObjectRecord(payload) && isObjectRecord(payload.error)) {
      const errorPayload = payload.error;

      const apiMessage = readString(errorPayload, "message");
      if (apiMessage && apiMessage.length > 0) {
        message = apiMessage;
      }

      code = readString(errorPayload, "code");

      const apiDetails = errorPayload.details;
      if (isObjectRecord(apiDetails)) {
        details = apiDetails;
      }
    }
  } catch {
    // no-op
  }

  throw new ChatApiError({ message, status: response.status, code, details });
}

export function getDeprecatedModelError(error: unknown): DeprecatedModelError | null {
  if (!(error instanceof ChatApiError)) return null;
  if (error.code !== "MODEL_DEPRECATED") return null;

  const details = error.details;
  if (!details) return null;

  const modelId = readString(details, "modelId");
  const replacementModelId = readString(details, "replacementModelId");

  if (!modelId || !replacementModelId) return null;

  const modelName = readString(details, "modelName") ?? modelId;
  const replacementModelName = readString(details, "replacementModelName") ?? replacementModelId;

  return {
    message: error.message,
    modelId,
    modelName,
    replacementModelId,
    replacementModelName,
  };
}

export function getClientErrorMessage(error: unknown): string {
  if (error instanceof Error && typeof error.message === "string") {
    const message = error.message.trim();
    if (message.length > 0) return message;
  }

  return GENERIC_CLIENT_ERROR;
}
