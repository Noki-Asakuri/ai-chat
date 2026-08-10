export const AUTH_ERROR_COOKIE_NAME = "auth-error";

const STACK_TRACE_MAX_LENGTH = 1_000;

export type AuthErrorDiagnostic = {
  code: string;
  message: string;
  stack: string | null;
  stackTruncated: boolean;
};

export function createAuthErrorDiagnostic(error: unknown): AuthErrorDiagnostic {
  let code = "UnknownError";
  let message = "Unknown authentication error";
  let stack: string | null = null;

  if (error instanceof Error) {
    code = error.name;
    message = error.message;
    stack = error.stack ?? null;

    if ("code" in error && typeof error.code === "string") {
      code = error.code;
    }
  } else if (typeof error === "string") {
    code = "Error";
    message = error;
  } else if (typeof error === "object" && error !== null) {
    if ("code" in error && typeof error.code === "string") {
      code = error.code;
    } else if ("name" in error && typeof error.name === "string") {
      code = error.name;
    }

    if ("message" in error && typeof error.message === "string") {
      message = error.message;
    }

    if ("stack" in error && typeof error.stack === "string") {
      stack = error.stack;
    }
  }

  if (stack !== null && stack.length > STACK_TRACE_MAX_LENGTH) {
    return {
      code,
      message,
      stack: stack.slice(0, STACK_TRACE_MAX_LENGTH),
      stackTruncated: true,
    };
  }

  return { code, message, stack, stackTruncated: false };
}

export function parseAuthErrorDiagnostic(value: string | undefined): AuthErrorDiagnostic | null {
  if (!value) return null;

  try {
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("code" in parsed) ||
      typeof parsed.code !== "string" ||
      !("message" in parsed) ||
      typeof parsed.message !== "string" ||
      !("stack" in parsed) ||
      (parsed.stack !== null && typeof parsed.stack !== "string") ||
      !("stackTruncated" in parsed) ||
      typeof parsed.stackTruncated !== "boolean"
    ) {
      return null;
    }

    const { code, message, stack, stackTruncated } = parsed;
    return { code, message, stack, stackTruncated };
  } catch {
    return null;
  }
}
