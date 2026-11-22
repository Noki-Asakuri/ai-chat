import { describe, expect, test } from "bun:test";

import { chooseCallbackErrorAction, isAuthCodeReplayError } from "./callback-recovery";

class OauthException extends Error {
  override name = "OauthException";

  constructor(
    readonly error: string,
    readonly errorDescription: string,
  ) {
    super(`Error: ${error}\nError Description: ${errorDescription}`);
  }
}

function namedError(name: string): Error {
  const error = new Error(name);
  error.name = name;
  return error;
}

const exchanged = new OauthException("invalid_grant", "The code '01M8' has already been exchanged.");

describe("isAuthCodeReplayError", () => {
  test("matches a code that was already exchanged", () => {
    expect(isAuthCodeReplayError(exchanged)).toBe(true);
  });

  test("matches a replay that arrives after the verifier cookie was cleared", () => {
    expect(isAuthCodeReplayError(namedError("PKCECookieMissingError"))).toBe(true);
  });

  test("ignores other grant failures and unrelated errors", () => {
    expect(isAuthCodeReplayError(new OauthException("invalid_grant", "The code has expired."))).toBe(false);
    expect(isAuthCodeReplayError(new OauthException("invalid_client", "already been exchanged"))).toBe(false);
    expect(isAuthCodeReplayError(namedError("OAuthStateMismatchError"))).toBe(false);
    expect(isAuthCodeReplayError("already been exchanged")).toBe(false);
  });
});

describe("chooseCallbackErrorAction", () => {
  test("sends a signed-in user on for any callback error", () => {
    expect(
      chooseCallbackErrorAction({
        error: namedError("OAuthStateMismatchError"),
        signedIn: true,
        alreadyRetried: true,
        returnPath: "/threads/abc",
      }),
    ).toEqual({ type: "redirect", path: "/threads/abc", markRetry: false });
  });

  test("retries a replayed code once when signed out", () => {
    expect(
      chooseCallbackErrorAction({
        error: exchanged,
        signedIn: false,
        alreadyRetried: false,
        returnPath: "/",
      }),
    ).toEqual({ type: "redirect", path: "/", markRetry: true });
  });

  test("shows the error page when the retry already happened", () => {
    expect(
      chooseCallbackErrorAction({ error: exchanged, signedIn: false, alreadyRetried: true, returnPath: "/" }),
    ).toEqual({ type: "fail" });
  });

  test("shows the error page for real failures", () => {
    expect(
      chooseCallbackErrorAction({
        error: new OauthException("invalid_grant", "The code has expired."),
        signedIn: false,
        alreadyRetried: false,
        returnPath: "/",
      }),
    ).toEqual({ type: "fail" });
  });
});
