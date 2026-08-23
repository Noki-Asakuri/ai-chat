import type { UseStorage } from "convex-helpers/react/sessions";
import type { SessionId } from "convex-helpers/server/sessions";
import { useCallback, useEffect, useRef, useState } from "react";

type SessionValue = SessionId | undefined;

/**
 * Cookie-backed storage for Convex sessions. The alias prevents React Compiler
 * from treating the callback passed to SessionProvider as a hook invocation.
 */
export const sessionUseCookie: UseStorage<SessionValue> = useSessionCookie;

function useSessionCookie(
  key: string,
  initialValue: SessionValue,
): ReturnType<UseStorage<SessionValue>> {
  const initialRef = useRef(initialValue);

  const [value, setValueState] = useState<SessionValue>(function () {
    return readCookieValue(key, initialValue);
  });

  useEffect(
    function () {
      setValueState(readCookieValue(key, initialRef.current));
    },
    [key],
  );

  const setValue = useCallback(
    function (next: SessionValue) {
      setValueState(next);
      writeCookieValue(key, next);
    },
    [key],
  );

  const remove = useCallback(
    function () {
      deleteCookie(key);
      setValueState(initialRef.current);
    },
    [key],
  );

  return [value, setValue, remove];
}

function readCookieValue(key: string, initialValue: SessionValue): SessionValue {
  if (!("document" in globalThis)) return initialValue;

  const raw = getCookieRaw(key);
  if (raw === null) return initialValue;

  try {
    const decoded = decodeURIComponent(raw);
    return isSessionId(decoded) ? decoded : initialValue;
  } catch {
    return initialValue;
  }
}

function writeCookieValue(key: string, value: SessionValue): void {
  if (!("document" in globalThis)) return;

  if (value === undefined) {
    deleteCookie(key);
    return;
  }

  setCookieRaw(key, value);
}

function isSessionId(value: string): value is SessionId {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
    value,
  );
}

function getCookieRaw(name: string): string | null {
  const encodedName = encodeURIComponent(name);
  const all = document.cookie;
  if (!all) return null;

  const matchingPart = all
    .split(";")
    .find((rawPart) => rawPart.trim().startsWith(`${encodedName}=`));
  if (!matchingPart) return null;

  return matchingPart.trim().slice(encodedName.length + 1);
}

function setCookieRaw(name: string, value: string): void {
  const parts = [
    `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
    "Path=/",
    "SameSite=Lax",
  ];
  if (isLikelyHttps()) parts.push("Secure");

  document.cookie = parts.join("; ");
}

function deleteCookie(name: string): void {
  if (!("document" in globalThis)) return;

  const parts = [
    `${encodeURIComponent(name)}=`,
    "Path=/",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (isLikelyHttps()) parts.push("Secure");

  document.cookie = parts.join("; ");
}

function isLikelyHttps(): boolean {
  return "location" in globalThis && location.protocol === "https:";
}
