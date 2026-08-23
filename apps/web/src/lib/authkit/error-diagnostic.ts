import { z } from "zod/v4";

export const AUTH_ERROR_COOKIE_NAME = "auth-error";

const STACK_TRACE_MAX_LENGTH = 1_000;

export type AuthErrorDiagnostic = {
  code: string;
  message: string;
  stack: string | null;
  stackTruncated: boolean;
};

const authErrorDiagnosticSchema = z.object({
  code: z.string(),
  message: z.string(),
  stack: z.string().nullable(),
  stackTruncated: z.boolean(),
});

function getErrorCode(error: Error): string {
  if (!("code" in error)) return error.name;
  const result = z.string().safeParse(error.code);
  return result.success ? result.data : error.name;
}

export function createAuthErrorDiagnostic(cause: unknown): AuthErrorDiagnostic {
  const error = cause instanceof Error ? cause : new Error(String(cause));
  const code = getErrorCode(error);
  const message = error.message || "Unknown authentication error";
  const stack = error.stack ?? null;

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
    const result = authErrorDiagnosticSchema.safeParse(JSON.parse(value));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
