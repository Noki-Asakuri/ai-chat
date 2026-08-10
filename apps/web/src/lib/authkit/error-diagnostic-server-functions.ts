import { createServerFn } from "@tanstack/react-start";
import { deleteCookie, getCookie, setResponseHeader } from "@tanstack/react-start/server";

import { AUTH_ERROR_COOKIE_NAME, parseAuthErrorDiagnostic } from "./error-diagnostic";

export const getAuthErrorDiagnostic = createServerFn({ method: "GET" }).handler(function () {
  const diagnostic = parseAuthErrorDiagnostic(getCookie(AUTH_ERROR_COOKIE_NAME));
  deleteCookie(AUTH_ERROR_COOKIE_NAME, { path: "/auth/error" });
  setResponseHeader("Cache-Control", "no-store");
  return diagnostic;
});
