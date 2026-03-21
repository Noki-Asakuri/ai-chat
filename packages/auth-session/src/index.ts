import type { Impersonator, User } from "@workos-inc/node";
import {
  CookieSessionStorage,
  configure,
  createAuthService,
  sessionEncryption,
  type AuthKitConfig,
  type AuthResult,
  type HeadersBag,
} from "@workos/authkit-session";
import { decodeJwt } from "jose";

export const DEFAULT_AUTH_SESSION_COOKIE_NAME = "wos-session";
export const DEFAULT_AUTH_SESSION_COOKIE_MAX_AGE = 2_592_000;
export const DEFAULT_AUTH_SESSION_REFRESH_BUFFER_SECONDS = 60;

export type Session = {
  accessToken: string;
  refreshToken: string;
  user: User;
  impersonator?: Impersonator;
};

export async function decryptAuthSession(encryptedSession: string, cookiePassword: string) {
  return sessionEncryption.unsealData<Session>(encryptedSession, { password: cookiePassword });
}

export type AuthSessionConfig = {
  apiKey: string;
  clientId: string;
  cookiePassword: string;
  apiHostname?: string;
  apiHttps?: boolean;
  apiPort?: number;
  cookieMaxAge?: number;
  cookieSameSite?: "lax" | "strict" | "none";
  cookieName?: string;
  cookieDomain?: string;
};

export type AuthenticatedRequestSession = {
  userId: string;
  getAccessToken: () => Promise<string>;
  getPendingSetCookieHeader: () => string | null;
  flushPendingSetCookieHeader: () => string | null;
};

export type AuthSessionPersistence = {
  resolveLatestSessionData?: (options: {
    sessionId: string | null;
    userId: string | null;
    refreshToken: string | null;
    sessionData: string;
  }) => Promise<string | null>;
  persistLatestSessionData?: (options: {
    sessionId: string | null;
    previousRefreshToken: string | null;
    previousSessionId: string | null;
    userId: string;
    sessionData: string;
    session: Session;
  }) => Promise<void>;
  clearLatestSessionData?: (options: {
    sessionId: string | null;
    refreshToken: string | null;
    userId: string | null;
  }) => Promise<void>;
};

export type AuthenticateRequestSessionResult =
  | {
      authenticated: false;
      clearSessionHeader: string | null;
    }
  | {
      authenticated: true;
      clearSessionHeader: null;
      session: AuthenticatedRequestSession;
    };

type AuthRequest = {
  headers: {
    get: (name: string) => string | null;
  };
};

class RequestCookieSessionStorage extends CookieSessionStorage<AuthRequest, undefined> {
  async getSession(request: AuthRequest): Promise<string | null> {
    const cookieHeader = request.headers.get("cookie");
    if (!cookieHeader) return null;
    const value = readCookieFromHeader(cookieHeader, this.cookieName);
    return value ?? null;
  }
}

function getCookieName(config: AuthSessionConfig): string {
  return config.cookieName ?? DEFAULT_AUTH_SESSION_COOKIE_NAME;
}

function toAuthKitConfig(config: AuthSessionConfig): AuthKitConfig {
  return {
    apiKey: config.apiKey,
    clientId: config.clientId,
    cookiePassword: config.cookiePassword,
    apiHostname: config.apiHostname,
    apiHttps: config.apiHttps ?? true,
    apiPort: config.apiPort,
    cookieMaxAge: config.cookieMaxAge ?? DEFAULT_AUTH_SESSION_COOKIE_MAX_AGE,
    cookieSameSite: config.cookieSameSite,
    cookieName: getCookieName(config),
    cookieDomain: config.cookieDomain,
    redirectUri: "",
  };
}

function createRequestAuthService(config: AuthSessionConfig) {
  const authKitConfig = toAuthKitConfig(config);
  configure(authKitConfig);

  return createAuthService<AuthRequest, undefined>({
    sessionStorageFactory: function sessionStorageFactory() {
      return new RequestCookieSessionStorage(authKitConfig);
    },
    encryptionFactory: function encryptionFactory() {
      return sessionEncryption;
    },
  });
}

function extractSetCookieHeader(options: {
  headers?: HeadersBag;
  response?: {
    headers?: {
      get: (name: string) => string | null;
    };
  };
}): string | null {
  const headerValue = options.headers?.["Set-Cookie"];
  if (typeof headerValue === "string") return headerValue;
  if (Array.isArray(headerValue) && headerValue[0]) return headerValue[0];

  return options.response?.headers?.get("Set-Cookie") ?? null;
}

function createAuthRequestWithSessionData(options: {
  cookieName: string;
  sessionData: string;
}): AuthRequest {
  return {
    headers: {
      get: function get(name: string): string | null {
        if (name.toLowerCase() !== "cookie") return null;
        return `${options.cookieName}=${encodeURIComponent(options.sessionData)}`;
      },
    },
  };
}

function getSessionId(session: Session): string | null {
  try {
    const claims = decodeJwt(session.accessToken);
    return typeof claims.sid === "string" ? claims.sid : null;
  } catch {
    return null;
  }
}

async function clearPersistedSessionData(options: {
  persistence?: AuthSessionPersistence;
  session: Session | null;
}): Promise<void> {
  if (!options.persistence?.clearLatestSessionData) return;

  await options.persistence.clearLatestSessionData({
    sessionId: options.session ? getSessionId(options.session) : null,
    refreshToken: options.session?.refreshToken ?? null,
    userId: options.session?.user.id ?? null,
  });
}

async function tryDecryptSessionData(options: {
  sessionData: string | null;
  cookiePassword: string;
}): Promise<Session | null> {
  if (!options.sessionData) return null;

  try {
    return await decryptAuthSession(options.sessionData, options.cookiePassword);
  } catch {
    return null;
  }
}

function isTokenExpiringSoon(accessToken: string, bufferSeconds: number): boolean {
  try {
    const claims = decodeJwt(accessToken);
    if (typeof claims.exp !== "number") return true;

    const currentTimestamp = Math.floor(Date.now() / 1000);
    return claims.exp - currentTimestamp <= bufferSeconds;
  } catch {
    return true;
  }
}

async function buildSessionSaveHeader(options: {
  authService: ReturnType<typeof createRequestAuthService>;
  sessionData: string;
}): Promise<string | null> {
  const saved = await options.authService.saveSession(undefined, options.sessionData);
  return extractSetCookieHeader(saved);
}

export async function buildClearAuthSessionHeader(
  config: AuthSessionConfig,
): Promise<string | null> {
  const authService = createRequestAuthService(config);
  const cleared = await authService.clearSession(undefined);
  return extractSetCookieHeader(cleared);
}

export async function authenticateRequestSession(options: {
  request: AuthRequest;
  config: AuthSessionConfig;
  refreshBufferSeconds?: number;
  persistence?: AuthSessionPersistence;
}): Promise<AuthenticateRequestSessionResult> {
  const authService = createRequestAuthService(options.config);
  const cookieName = getCookieName(options.config);
  const cookieHeader = options.request.headers.get("cookie") ?? undefined;
  const originalSessionData = readCookieFromHeader(cookieHeader, cookieName);
  const hasCookie = originalSessionData !== null;
  const originalSession = await tryDecryptSessionData({
    sessionData: originalSessionData,
    cookiePassword: options.config.cookiePassword,
  });
  const latestSessionData =
    originalSessionData && options.persistence?.resolveLatestSessionData
      ? await options.persistence.resolveLatestSessionData({
          refreshToken: originalSession?.refreshToken ?? null,
          sessionId: originalSession ? getSessionId(originalSession) : null,
          sessionData: originalSessionData,
          userId: originalSession?.user.id ?? null,
        })
      : null;
  const sessionDataForAuth = latestSessionData ?? originalSessionData;
  const requestForAuth =
    sessionDataForAuth && sessionDataForAuth !== originalSessionData
      ? createAuthRequestWithSessionData({ cookieName, sessionData: sessionDataForAuth })
      : options.request;
  const { auth, refreshedSessionData } = await authService.withAuth(requestForAuth);

  if (!isAuthenticatedAuthResult(auth)) {
    await clearPersistedSessionData({
      persistence: options.persistence,
      session: originalSession,
    });

    return {
      authenticated: false,
      clearSessionHeader: hasCookie ? await buildClearAuthSessionHeader(options.config) : null,
    };
  }

  const authenticatedAuth = auth;

  let sessionState: Session = {
    accessToken: authenticatedAuth.accessToken,
    refreshToken: authenticatedAuth.refreshToken,
    user: authenticatedAuth.user,
    impersonator: authenticatedAuth.impersonator,
  };

  const sessionId = getSessionId(sessionState);
  const previousRefreshToken = originalSession?.refreshToken ?? sessionState.refreshToken;
  const previousSessionId = originalSession ? getSessionId(originalSession) : sessionId;
  let pendingSetCookieHeader =
    sessionDataForAuth && sessionDataForAuth !== originalSessionData
      ? await buildSessionSaveHeader({ authService, sessionData: sessionDataForAuth })
      : null;

  if (refreshedSessionData) {
    pendingSetCookieHeader = await buildSessionSaveHeader({
      authService,
      sessionData: refreshedSessionData,
    });

    await options.persistence?.persistLatestSessionData?.({
      sessionId,
      previousRefreshToken,
      previousSessionId,
      session: sessionState,
      sessionData: refreshedSessionData,
      userId: sessionState.user.id,
    });
  }

  let refreshPromise: Promise<string> | null = null;
  const refreshBufferSeconds =
    options.refreshBufferSeconds ?? DEFAULT_AUTH_SESSION_REFRESH_BUFFER_SECONDS;

  async function refreshAccessToken(): Promise<string> {
    try {
      const refreshed = await authService.refreshSession(sessionState);
      if (!isAuthenticatedAuthResult(refreshed.auth)) {
        throw new Error("Refreshed session is unauthenticated");
      }

      const previousRefreshToken = sessionState.refreshToken;
      const previousSessionId = getSessionId(sessionState);

      sessionState = {
        accessToken: refreshed.auth.accessToken,
        refreshToken: refreshed.auth.refreshToken,
        user: refreshed.auth.user,
        impersonator: refreshed.auth.impersonator,
      };

      pendingSetCookieHeader = await buildSessionSaveHeader({
        authService,
        sessionData: refreshed.encryptedSession,
      });

      await options.persistence?.persistLatestSessionData?.({
        sessionId: getSessionId(sessionState),
        previousRefreshToken,
        previousSessionId,
        session: sessionState,
        sessionData: refreshed.encryptedSession,
        userId: sessionState.user.id,
      });

      return sessionState.accessToken;
    } catch (error) {
      await clearPersistedSessionData({
        persistence: options.persistence,
        session: sessionState,
      });

      pendingSetCookieHeader = await buildClearAuthSessionHeader(options.config);
      throw error;
    }
  }

  function flushPendingSetCookieHeader(): string | null {
    const header = pendingSetCookieHeader;
    pendingSetCookieHeader = null;
    return header;
  }

  async function getAccessToken(): Promise<string> {
    if (!isTokenExpiringSoon(sessionState.accessToken, refreshBufferSeconds)) {
      return sessionState.accessToken;
    }

    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(function clearRefreshPromise() {
        refreshPromise = null;
      });
    }

    return await refreshPromise;
  }

  return {
    authenticated: true,
    clearSessionHeader: null,
    session: {
      userId: authenticatedAuth.user.id,
      getAccessToken,
      getPendingSetCookieHeader: function getPendingSetCookieHeader() {
        return pendingSetCookieHeader;
      },
      flushPendingSetCookieHeader,
    },
  };
}

export function isAuthenticatedAuthResult(
  auth: AuthResult,
): auth is Extract<AuthResult, { user: User }> {
  return auth.user !== null;
}

export type { AuthRequest };

export function readCookieFromHeader(cookieHeader: string | undefined, cookieName: string) {
  if (!cookieHeader) return null;

  const cookieEntries = cookieHeader.split(";");
  for (const entry of cookieEntries) {
    const [name, ...rawValueParts] = entry.trim().split("=");
    if (name !== cookieName) continue;

    const rawValue = rawValueParts.join("=");
    if (rawValue.length === 0) return null;

    try {
      return decodeURIComponent(rawValue);
    } catch {
      return null;
    }
  }

  return null;
}
