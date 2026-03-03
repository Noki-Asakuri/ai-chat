const GENERIC_CLIENT_ERROR = "Failed to process your request. Please try again.";

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function getClientErrorMessage(error: unknown): string {
  if (error instanceof Error && typeof error.message === "string") {
    const message = error.message.trim();
    if (message.length > 0) return message;
  }

  return GENERIC_CLIENT_ERROR;
}
