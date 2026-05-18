import type { AuthKitConfig, AuthResult, HeadersBag, Session } from "@workos/authkit-session";
import {
  CookieSessionStorage,
  configure,
  createAuthService,
  sessionEncryption,
} from "@workos/authkit-session";
import { Result, TaggedError, matchError, type Result as BetterResult } from "better-result";
import { createMiddleware } from "hono/factory";
import { decodeJwt } from "jose";

import { env } from "../env";
import { logger } from "../libs/axiom";

const DEFAULT_AUTH_SESSION_COOKIE_NAME = "wos-session";
const DEFAULT_AUTH_SESSION_COOKIE_MAX_AGE = 2_592_000;

type AuthRequest = {
  headers: { get: (name: string) => string | null };
};

type AuthenticatedAuthResult = Extract<AuthResult, { user: NonNullable<AuthResult["user"]> }>;

class WorkOSAuthError extends TaggedError("WorkOSAuthError")<{
  operation: string;
  message: string;
  cause: unknown;
}>() {
  constructor(args: { operation: string; cause: unknown }) {
    const message = args.cause instanceof Error ? args.cause.message : String(args.cause);
    super({ ...args, message: `WorkOS ${args.operation} failed: ${message}` });
  }
}

class SessionHeaderError extends TaggedError("SessionHeaderError")<{
  operation: string;
  message: string;
  cause: unknown;
}>() {
  constructor(args: { operation: string; cause: unknown }) {
    const message = args.cause instanceof Error ? args.cause.message : String(args.cause);
    super({ ...args, message: `Auth session ${args.operation} header failed: ${message}` });
  }
}

class UnauthenticatedError extends TaggedError("UnauthenticatedError")<{
  message: string;
  clearSessionHeader: string | null;
}>() {
  constructor(args: { clearSessionHeader: string | null }) {
    super({ ...args, message: "Unauthenticated" });
  }
}

class RefreshAccessTokenError extends TaggedError("RefreshAccessTokenError")<{
  message: string;
  cause: unknown;
  clearSessionHeader: string | null;
}>() {
  constructor(args: { cause: unknown; clearSessionHeader: string | null }) {
    const message = args.cause instanceof Error ? args.cause.message : String(args.cause);
    super({ ...args, message: `Auth session refresh failed: ${message}` });
  }
}

export type AuthContextError = WorkOSAuthError | SessionHeaderError | UnauthenticatedError;
type AccessTokenError = WorkOSAuthError | SessionHeaderError | RefreshAccessTokenError;

export type ServerAuthContext = {
  userId: string;
  sessionId: string;
  getAccessToken: () => Promise<string>;
  getPendingSetCookieHeader: () => string | null;
  flushPendingSetCookieHeader: () => string | null;
};

// @ts-ignore-error This doesn't work on the client so we just ignore this.
declare module "hono" {
  interface ContextVariableMap {
    auth: ServerAuthContext;
  }
}

class HonoCookieSessionStorage extends CookieSessionStorage<AuthRequest, Response | undefined> {
  async getSession(request: AuthRequest): Promise<string | null> {
    const cookieHeader = request.headers.get("cookie");
    if (!cookieHeader) return null;

    return readCookieFromHeader(cookieHeader, this.cookieName);
  }

  async getCookie(request: AuthRequest): Promise<string | null> {
    const cookieHeader = request.headers.get("cookie");
    if (!cookieHeader) return null;

    return readCookieFromHeader(cookieHeader, this.cookieName);
  }
}

function getAuthSessionConfig(): AuthKitConfig {
  return {
    apiKey: env.WORKOS_API_KEY,
    clientId: env.WORKOS_CLIENT_ID,
    cookiePassword: env.WORKOS_COOKIE_PASSWORD,
    cookieDomain: env.WORKOS_COOKIE_DOMAIN,
    cookieMaxAge: env.WORKOS_COOKIE_MAX_AGE ?? DEFAULT_AUTH_SESSION_COOKIE_MAX_AGE,
    cookieName: env.WORKOS_COOKIE_NAME ?? DEFAULT_AUTH_SESSION_COOKIE_NAME,
    cookieSameSite: env.WORKOS_COOKIE_SAME_SITE,
    redirectUri: "",
    apiHttps: true,
  };
}

function createHonoAuthService() {
  const config = getAuthSessionConfig();
  configure(config);

  return createAuthService<AuthRequest, Response | undefined>({
    sessionStorageFactory: function sessionStorageFactory(authConfig) {
      return new HonoCookieSessionStorage(authConfig);
    },
    encryptionFactory: function encryptionFactory() {
      return sessionEncryption;
    },
  });
}

const authService = createHonoAuthService();

function extractSetCookieHeader(headers?: HeadersBag): string | null {
  const header = headers?.["Set-Cookie"];
  if (typeof header === "string") return header;
  if (Array.isArray(header)) return header[0] ?? null;

  return null;
}

function isAuthenticatedAuthResult(auth: AuthResult): auth is AuthenticatedAuthResult {
  return auth.user !== null;
}

function toAuthSession(auth: AuthenticatedAuthResult): Session {
  return {
    user: auth.user,
    accessToken: auth.accessToken,
    refreshToken: auth.refreshToken,
    impersonator: auth.impersonator,
  };
}

function isTokenExpiringSoon(accessToken: string): boolean {
  const claimsResult = Result.try({
    try: function decodeAccessToken() {
      return decodeJwt(accessToken);
    },
    catch: function mapDecodeError(cause) {
      return new WorkOSAuthError({ operation: "decode access token", cause });
    },
  });

  if (Result.isError(claimsResult)) return true;

  const claims = claimsResult.value;
  if (typeof claims.exp !== "number") return true;

  const currentTimestamp = Math.floor(Date.now() / 1000);
  return claims.exp - currentTimestamp <= 60;
}

async function buildSessionSaveHeaderResult(
  sessionData: string,
): Promise<BetterResult<string | null, SessionHeaderError>> {
  const savedResult = await Result.tryPromise({
    try: function saveSession() {
      return authService.saveSession(undefined, sessionData);
    },
    catch: function mapSaveSessionError(cause) {
      return new SessionHeaderError({ operation: "save", cause });
    },
  });

  if (Result.isError(savedResult)) {
    return Result.err(savedResult.error);
  }

  return Result.ok(extractSetCookieHeader(savedResult.value.headers));
}

async function buildClearSessionHeaderResult(): Promise<BetterResult<string | null, SessionHeaderError>> {
  const clearedResult = await Result.tryPromise({
    try: function clearSession() {
      return authService.clearSession(undefined);
    },
    catch: function mapClearSessionError(cause) {
      return new SessionHeaderError({ operation: "clear", cause });
    },
  });

  if (Result.isError(clearedResult)) {
    return Result.err(clearedResult.error);
  }

  return Result.ok(extractSetCookieHeader(clearedResult.value.headers));
}

async function getAuthenticatedRequestResult(request: Request): Promise<
  BetterResult<
    {
      auth: AuthenticatedAuthResult;
      pendingSetCookieHeader: string | null;
    },
    AuthContextError
  >
> {
  const authResult = await Result.tryPromise({
    try: function withAuth() {
      return authService.withAuth(request);
    },
    catch: function mapWithAuthError(cause) {
      return new WorkOSAuthError({ operation: "withAuth", cause });
    },
  });

  if (Result.isError(authResult)) {
    return Result.err(authResult.error);
  }

  const { auth, refreshedSessionData } = authResult.value;
  if (!isAuthenticatedAuthResult(auth)) {
    const clearHeaderResult = await buildClearSessionHeaderResult();
    if (Result.isError(clearHeaderResult)) {
      return Result.err(clearHeaderResult.error);
    }

    return Result.err(new UnauthenticatedError({ clearSessionHeader: clearHeaderResult.value }));
  }

  if (!refreshedSessionData) {
    return Result.ok({ auth, pendingSetCookieHeader: null });
  }

  const sessionHeaderResult = await buildSessionSaveHeaderResult(refreshedSessionData);
  if (Result.isError(sessionHeaderResult)) {
    return Result.err(sessionHeaderResult.error);
  }

  return Result.ok({ auth, pendingSetCookieHeader: sessionHeaderResult.value });
}

async function refreshAccessTokenResult(
  session: Session,
): Promise<
  BetterResult<
    { accessToken: string; session: Session; pendingSetCookieHeader: string | null },
    AccessTokenError
  >
> {
  const refreshedResult = await Result.tryPromise({
    try: function refreshSession() {
      return authService.refreshSession(session);
    },
    catch: function mapRefreshSessionError(cause) {
      return new WorkOSAuthError({ operation: "refreshSession", cause });
    },
  });

  if (Result.isError(refreshedResult)) {
    const clearHeaderResult = await buildClearSessionHeaderResult();
    const clearSessionHeader = Result.isOk(clearHeaderResult) ? clearHeaderResult.value : null;
    return Result.err(new RefreshAccessTokenError({ cause: refreshedResult.error, clearSessionHeader }));
  }

  if (!isAuthenticatedAuthResult(refreshedResult.value.auth)) {
    const clearHeaderResult = await buildClearSessionHeaderResult();
    const clearSessionHeader = Result.isOk(clearHeaderResult) ? clearHeaderResult.value : null;
    return Result.err(
      new RefreshAccessTokenError({
        cause: new UnauthenticatedError({ clearSessionHeader }),
        clearSessionHeader,
      }),
    );
  }

  const nextSession = toAuthSession(refreshedResult.value.auth);
  const sessionHeaderResult = await buildSessionSaveHeaderResult(refreshedResult.value.encryptedSession);
  if (Result.isError(sessionHeaderResult)) {
    return Result.err(sessionHeaderResult.error);
  }

  return Result.ok({
    accessToken: nextSession.accessToken,
    session: nextSession,
    pendingSetCookieHeader: sessionHeaderResult.value,
  });
}

function getAuthErrorStatus(error: AuthContextError): 401 | 500 {
  return matchError(error, {
    UnauthenticatedError: function getUnauthenticatedStatus() {
      return 401;
    },
    SessionHeaderError: function getSessionHeaderStatus() {
      return 500;
    },
    WorkOSAuthError: function getWorkOSAuthStatus() {
      return 500;
    },
  });
}

function getAuthErrorSetCookieHeader(error: AuthContextError): string | null {
  return matchError(error, {
    UnauthenticatedError: function getUnauthenticatedHeader(unauthenticatedError) {
      return unauthenticatedError.clearSessionHeader;
    },
    SessionHeaderError: function getSessionHeaderErrorHeader() {
      return null;
    },
    WorkOSAuthError: function getWorkOSAuthErrorHeader() {
      return null;
    },
  });
}

function getAuthErrorResponseMessage(error: AuthContextError): string {
  return matchError(error, {
    UnauthenticatedError: function getUnauthenticatedMessage() {
      return "Error: Unauthenticated!";
    },
    SessionHeaderError: function getSessionHeaderMessage() {
      return "Error: Authentication failed!";
    },
    WorkOSAuthError: function getWorkOSAuthMessage() {
      return "Error: Authentication failed!";
    },
  });
}

function getAuthLogMessage(error: AuthContextError): string {
  return matchError(error, {
    UnauthenticatedError: function getUnauthenticatedLogMessage() {
      return "Unauthenticated";
    },
    SessionHeaderError: function getSessionHeaderLogMessage(sessionHeaderError) {
      return sessionHeaderError.message;
    },
    WorkOSAuthError: function getWorkOSAuthLogMessage(workOSAuthError) {
      return workOSAuthError.message;
    },
  });
}

function getAccessTokenErrorSetCookieHeader(error: AccessTokenError): string | null {
  return matchError(error, {
    RefreshAccessTokenError: function getRefreshHeader(refreshError) {
      return refreshError.clearSessionHeader;
    },
    SessionHeaderError: function getSessionHeaderErrorHeader() {
      return null;
    },
    WorkOSAuthError: function getWorkOSAuthErrorHeader() {
      return null;
    },
  });
}

function createServerAuthContext(options: {
  auth: AuthenticatedAuthResult;
  pendingSetCookieHeader: string | null;
}): ServerAuthContext {
  let session = toAuthSession(options.auth);
  let pendingSetCookieHeader = options.pendingSetCookieHeader;
  let refreshPromise: Promise<string> | null = null;

  async function refreshAccessToken(): Promise<string> {
    const refreshedResult = await refreshAccessTokenResult(session);
    if (Result.isError(refreshedResult)) {
      pendingSetCookieHeader = getAccessTokenErrorSetCookieHeader(refreshedResult.error);
      throw refreshedResult.error;
    }

    session = refreshedResult.value.session;
    pendingSetCookieHeader = refreshedResult.value.pendingSetCookieHeader;

    return refreshedResult.value.accessToken;
  }

  async function getAccessToken(): Promise<string> {
    if (!isTokenExpiringSoon(session.accessToken)) {
      return session.accessToken;
    }

    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(function clearRefreshPromise() {
        refreshPromise = null;
      });
    }

    return await refreshPromise;
  }

  function flushPendingSetCookieHeader(): string | null {
    const header = pendingSetCookieHeader;
    pendingSetCookieHeader = null;
    return header;
  }

  return {
    userId: options.auth.user.id,
    sessionId: options.auth.sessionId,
    getAccessToken,
    getPendingSetCookieHeader: function getPendingSetCookieHeader() {
      return pendingSetCookieHeader;
    },
    flushPendingSetCookieHeader,
  };
}

function appendSessionHeader(responseHeaders: Headers, header: string | null): void {
  if (!header) return;
  responseHeaders.append("Set-Cookie", header);
}

export async function getAuthContextResultFromRequest(
  request: Request,
): Promise<BetterResult<ServerAuthContext, AuthContextError>> {
  const authResult = await getAuthenticatedRequestResult(request);
  if (Result.isError(authResult)) {
    return Result.err(authResult.error);
  }

  return Result.ok(
    createServerAuthContext({
      auth: authResult.value.auth,
      pendingSetCookieHeader: authResult.value.pendingSetCookieHeader,
    }),
  );
}

export const authenticate = createMiddleware(async function authenticate(ctx, next) {
  const requestId = ctx.get("requestId");
  const authResult = await getAuthenticatedRequestResult(ctx.req.raw);

  if (Result.isError(authResult)) {
    appendSessionHeader(ctx.res.headers, getAuthErrorSetCookieHeader(authResult.error));

    logger.warn("[Auth] Request rejected (unauthenticated)", {
      requestId,
      path: ctx.req.path,
      method: ctx.req.method,
      message: getAuthLogMessage(authResult.error),
    });

    return ctx.json(
      { error: { message: getAuthErrorResponseMessage(authResult.error) } },
      getAuthErrorStatus(authResult.error),
    );
  }

  const serverAuth = createServerAuthContext({
    auth: authResult.value.auth,
    pendingSetCookieHeader: authResult.value.pendingSetCookieHeader,
  });

  ctx.set("auth", serverAuth);

  try {
    await next();
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    appendSessionHeader(ctx.res.headers, serverAuth.flushPendingSetCookieHeader());

    logger.warn("[Auth] Request failed after authentication", {
      requestId,
      path: ctx.req.path,
      method: ctx.req.method,
      message: err.message,
    });

    throw error;
  }

  appendSessionHeader(ctx.res.headers, serverAuth.flushPendingSetCookieHeader());
});

function readCookieFromHeader(cookieHeader: string | undefined, cookieName: string): string | null {
  if (!cookieHeader) return null;

  const cookieEntries = cookieHeader.split(";");
  for (const entry of cookieEntries) {
    const [name, ...rawValueParts] = entry.trim().split("=");
    if (name !== cookieName) continue;

    const rawValue = rawValueParts.join("=");
    if (rawValue.length === 0) return null;

    const decodedResult = Result.try({
      try: function decodeCookieValue() {
        return decodeURIComponent(rawValue);
      },
      catch: function mapDecodeCookieError(cause) {
        return new WorkOSAuthError({ operation: "decode session cookie", cause });
      },
    });

    if (Result.isError(decodedResult)) return null;

    return decodedResult.value;
  }

  return null;
}
