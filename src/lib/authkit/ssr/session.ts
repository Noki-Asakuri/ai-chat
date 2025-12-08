import { redirect } from "@tanstack/react-router";
import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";

import { OauthException, type AccessToken, type AuthenticationResponse } from "@workos-inc/node";
import { sealData, unsealData } from "iron-session";
import { createRemoteJWKSet, decodeJwt, jwtVerify } from "jose";

import { getConfig } from "./config";
import type {
  AuthkitOptions,
  AuthkitResponse,
  CookieOptions,
  GetAuthURLOptions,
  Session,
} from "./interfaces";
import { lazy } from "./utils";
import { getWorkOS } from "./workos";
import { tryCatch } from "@/lib/utils";

const sessionHeaderName = "x-workos-session";
const middlewareHeaderName = "x-workos-middleware";

export function getAuthorizationUrl(options: GetAuthURLOptions = {}) {
  const { returnPathname, screenHint, redirectUri } = options;

  return getWorkOS().userManagement.getAuthorizationUrl({
    provider: "authkit",
    clientId: getConfig("clientId"),
    redirectUri: redirectUri || getConfig("redirectUri"),
    state: returnPathname ? btoa(JSON.stringify({ returnPathname })) : undefined,
    screenHint,
  });
}

export function serializeCookie(
  name: string,
  value: string,
  options: Partial<CookieOptions> = {},
): string {
  const {
    path = "/",
    maxAge = getConfig("cookieMaxAge"),
    secure = options.sameSite === "none" ? true : getConfig("redirectUri").startsWith("https:"),
    sameSite = "lax",
    domain = getConfig("cookieDomain"),
  } = options;

  let cookie = `${name}=${encodeURIComponent(value)}; Path=${path}; sameSite=${sameSite}; HttpOnly`;
  cookie += `; Max-Age=${maxAge}`;
  if (!maxAge) cookie += `; Expires=${new Date(0).toUTCString()}`;
  if (secure) cookie += "; Secure";
  if (domain) cookie += `; Domain=${domain}`;

  return cookie;
}

export async function decryptSession(encryptedSession: string): Promise<Session> {
  const cookiePassword = getConfig("cookiePassword");
  return unsealData<Session>(encryptedSession, {
    password: cookiePassword,
  });
}

export async function encryptSession(session: Session) {
  return sealData(session, {
    password: getConfig("cookiePassword"),
    ttl: 0,
  });
}

export async function withAuth() {
  const session = await getSessionFromCookie();
  if (!session?.user) return { user: null };

  const {
    sid: sessionId,
    org_id: organizationId,
    role,
    permissions,
    entitlements,
  } = decodeJwt<AccessToken>(session.accessToken);

  return {
    sessionId,
    user: session.user,
    organizationId,
    role,
    permissions,
    entitlements,
    impersonator: session.impersonator,
    accessToken: session.accessToken,
  };
}

export async function getSessionFromCookie() {
  const cookieName = getConfig("cookieName") || "wos-session";
  const cookie = getCookie(cookieName);

  if (cookie) return decryptSession(cookie);
}

export async function saveSession(
  sessionOrResponse: Session | AuthenticationResponse,
): Promise<void> {
  const cookieName = getConfig("cookieName") || "wos-session";
  const encryptedSession = await encryptSession(sessionOrResponse);

  setCookie(cookieName, encryptedSession);
}

// JWKS call only happens once and the result is cached. The lazy function ensures that
// the JWK set is only created when it's needed, and not before.
const JWKS = lazy(() =>
  createRemoteJWKSet(new URL(getWorkOS().userManagement.getJwksUrl(getConfig("clientId")))),
);

export async function verifyAccessToken(accessToken: string): Promise<boolean> {
  try {
    await jwtVerify(accessToken, JWKS());
    return true;
  } catch {
    return false;
  }
}

function getReturnPathname(url: string): string {
  const newUrl = new URL(url);

  return `${newUrl.pathname}${newUrl.searchParams.size > 0 ? "?" + newUrl.searchParams.toString() : ""}`;
}

/**
 * Updates and validates the current AuthKit session based on the request's session cookie.
 *
 * Behavior:
 * - Reads the session cookie and attempts to decrypt it.
 * - Verifies the stored access token against the remote JWKS.
 * - If the token is valid, attaches the encrypted session to returned headers for downstream middleware.
 * - If the token is expired/invalid, attempts to refresh it using the refresh token and returns updated
 *   headers including a Set-Cookie header with the new encrypted session on success.
 * - If refreshing fails or no session exists, returns an authorization URL to begin authentication and headers
 *   indicating the middleware executed. When a cookie is deleted it is returned via `Set-Cookie` with Max-Age=0.
 *
 * @param request - The incoming Request object; its URL is recorded in headers for return-path tracking.
 * @param options - Optional settings (AuthkitOptions):
 *   - debug: enable console logging (default: false)
 *   - redirectUri: override redirect URI used when generating authorization URLs
 *   - screenHint: optional screen hint passed to getAuthorizationUrl
 *
 * @returns A Promise that resolves to an AuthkitResponse containing:
 *   - session: the resolved session information (or { user: null } if unauthenticated)
 *   - headers: Headers to be applied by middleware/edge (may include Set-Cookie, x-workos-session, x-workos-middleware)
 *   - authorizationUrl: present when the client must be redirected to AuthKit for login
 */
export async function updateSession(
  request: Request,
  options: AuthkitOptions = { debug: false },
): Promise<AuthkitResponse> {
  const session = await getSessionFromCookie();

  const newRequestHeaders = new Headers();

  // Record that the request was routed through the middleware so we can check later for DX purposes
  newRequestHeaders.set(middlewareHeaderName, "true");

  // We store the current request url in a custom header, so we can always have access to it
  // This is because on hard navigations we don't have access to `next-url` but need to get the current
  // `pathname` to be able to return the users where they came from before sign-in
  newRequestHeaders.set("x-url", request.url);

  if (options.redirectUri) {
    // Store the redirect URI in a custom header, so we always have access to it and so that subsequent
    // calls to `getAuthorizationUrl` will use the same redirect URI
    newRequestHeaders.set("x-redirect-uri", options.redirectUri);
  }

  newRequestHeaders.delete(sessionHeaderName);

  if (!session) {
    if (options.debug) {
      console.log("No session found from cookie");
    }

    return {
      session: { user: null },
      headers: newRequestHeaders,
      authorizationUrl: getAuthorizationUrl({
        returnPathname: getReturnPathname(request.url),
        redirectUri: options.redirectUri || getConfig("redirectUri"),
        screenHint: options.screenHint,
      }),
    };
  }

  const hasValidSession = await verifyAccessToken(session.accessToken);

  const cookieName = getConfig("cookieName") || "wos-session";

  if (hasValidSession) {
    newRequestHeaders.set(sessionHeaderName, getCookie(cookieName)!);

    const {
      sid: sessionId,
      org_id: organizationId,
      role,
      permissions,
      entitlements,
    } = decodeJwt<AccessToken>(session.accessToken);

    return {
      session: {
        sessionId,
        user: session.user,
        organizationId,
        role,
        permissions,
        entitlements,
        impersonator: session.impersonator,
        accessToken: session.accessToken,
      },
      headers: newRequestHeaders,
    };
  }

  try {
    if (options.debug) {
      // istanbul ignore next
      console.log(
        `Session invalid. ${session.accessToken ? `Refreshing access token that ends in ${session.accessToken.slice(-10)}` : "Access token missing."}`,
      );
    }

    const { org_id: organizationIdFromAccessToken } = decodeJwt<AccessToken>(session.accessToken);

    const { accessToken, refreshToken, user, impersonator } =
      await getWorkOS().userManagement.authenticateWithRefreshToken({
        clientId: getConfig("clientId"),
        refreshToken: session.refreshToken,
        organizationId: organizationIdFromAccessToken,
      });

    if (options.debug) {
      console.log("Session successfully refreshed");
    }
    // Encrypt session with new access and refresh tokens
    const encryptedSession = await encryptSession({
      accessToken,
      refreshToken,
      user,
      impersonator,
    });

    newRequestHeaders.append("Set-Cookie", serializeCookie(cookieName, encryptedSession));
    newRequestHeaders.set(sessionHeaderName, encryptedSession);

    const {
      sid: sessionId,
      org_id: organizationId,
      role,
      permissions,
      entitlements,
    } = decodeJwt<AccessToken>(accessToken);

    return {
      session: {
        sessionId,
        user,
        organizationId,
        role,
        permissions,
        entitlements,
        impersonator,
        accessToken,
      },
      headers: newRequestHeaders,
    };
  } catch (e) {
    if (options.debug) {
      console.log("Failed to refresh. Deleting cookie.", e);
    }

    // When we need to delete a cookie, return it as a header as you can't delete cookies from edge middleware
    const deleteCookie = serializeCookie(cookieName, "", { maxAge: 0 });
    newRequestHeaders.append("Set-Cookie", deleteCookie);

    return {
      session: { user: null },
      headers: newRequestHeaders,
      authorizationUrl: getAuthorizationUrl({
        returnPathname: getReturnPathname(request.url),
      }),
    };
  }
}

export async function refreshSession(session: Session, forceRefreshToken: boolean = false) {
  const now = Date.now();
  console.debug("[Server] Refreshing access token at", new Date(now), {
    forceRefreshToken,
  });

  const decoded = decodeJwt<AccessToken>(session.accessToken);

  const TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutes total lifetime
  const REFRESH_AGE_THRESHOLD_MS = 4 * 60 * 1000; // start refreshing when token age ≥ 4 minutes
  const MIN_FORCE_REFRESH_AGE_MS = 1 * 60 * 1000; // ignore "force" if token age < 1 minute

  let timeUntilExpiryMs: number | null = null;
  let approxAgeMs: number | null = null;

  if (typeof decoded.exp === "number") {
    const expMs = decoded.exp * 1000;
    timeUntilExpiryMs = expMs - now;

    // Approximate age using the known TTL (5m): age ≈ TTL - timeLeft
    approxAgeMs = TOKEN_TTL_MS - timeUntilExpiryMs;
  }

  const tokenIsNew = approxAgeMs != null && approxAgeMs < MIN_FORCE_REFRESH_AGE_MS;

  const isNearExpiry =
    timeUntilExpiryMs != null && timeUntilExpiryMs <= TOKEN_TTL_MS - REFRESH_AGE_THRESHOLD_MS; // ~1 minute left

  const effectiveForceRefresh = forceRefreshToken && !tokenIsNew;
  const isValid = await verifyAccessToken(session.accessToken);
  const shouldRefresh = !isValid || isNearExpiry || effectiveForceRefresh;

  if (!shouldRefresh) {
    console.debug("[Server] Access token is valid and not near expiry; skipping refresh", {
      isValid,
      isNearExpiry,
      forceRefreshToken,
      effectiveForceRefresh,
      timeUntilExpiryMs,
      approxAgeMs,
    });

    return session;
  }

  console.debug(
    "[Server] Access token is invalid, near expiry, or force refresh is effective; refreshing",
    {
      isValid,
      isNearExpiry,
      forceRefreshToken,
      effectiveForceRefresh,
      timeUntilExpiryMs,
      approxAgeMs,
    },
  );

  const [newSession, error] = await tryCatch(
    getWorkOS().userManagement.authenticateWithRefreshToken({
      clientId: getConfig("clientId"),
      refreshToken: session.refreshToken,
    }),
  );

  if (error) {
    console.error("[Server] Failed to refresh access token, redirecting to login", error);

    const cookieName = getConfig("cookieName") || "wos-session";
    deleteCookie(cookieName);

    throw redirect({ to: "/auth/login", throw: true, reloadDocument: true });
  }

  console.debug("[Server] Access token refreshed");
  await saveSession(newSession);

  return newSession;
}

export async function terminateSession({ returnTo }: { returnTo?: string } = {}) {
  const { sessionId } = await withAuth();
  if (sessionId) {
    const href = getWorkOS().userManagement.getLogoutUrl({ sessionId, returnTo });
    return redirect({ href, throw: true, reloadDocument: true });
  }

  return redirect({ to: returnTo ?? "/", throw: true, reloadDocument: true });
}
