import { z } from "zod/v4";

export const AUTH_CALLBACK_RETRY_COOKIE_NAME = "auth-callback-retry";
export const AUTH_CALLBACK_RETRY_COOKIE_MAX_AGE = 600;

export type CallbackErrorAction = { type: "redirect"; path: string; markRetry: boolean } | { type: "fail" };

const codeAlreadyExchangedSchema = z.object({
  name: z.literal("OauthException"),
  error: z.literal("invalid_grant"),
  errorDescription: z.string().regex(/already been exchanged/i),
});

// A sign-in code is single-use, so a reloaded or duplicated callback request fails even though
// the first request signed the user in. PKCECookieMissingError is the same replay arriving after
// the first response already cleared the verifier cookie.
export function isAuthCodeReplayError(cause: unknown): boolean {
  if (!(cause instanceof Error)) return false;
  if (cause.name === "PKCECookieMissingError") return true;
  return codeAlreadyExchangedSchema.safeParse(cause).success;
}

export function chooseCallbackErrorAction(options: {
  error: unknown;
  signedIn: boolean;
  alreadyRetried: boolean;
  returnPath: string;
}): CallbackErrorAction {
  if (options.signedIn) return { type: "redirect", path: options.returnPath, markRetry: false };

  if (isAuthCodeReplayError(options.error) && !options.alreadyRetried) {
    return { type: "redirect", path: options.returnPath, markRetry: true };
  }

  return { type: "fail" };
}
