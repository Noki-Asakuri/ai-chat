import type { UseStorage } from "convex-helpers/react/sessions";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * This is a wrapper around useCookie so that React Compiler don't mark it as a hook.
 * And not auto memoize it.
 */
export const sessionUseCookie = useCookie;

export function useCookie<T>(key: string, initialValue: T): ReturnType<UseStorage<T>> {
  const initialRef = useRef(initialValue);

  const [value, setValueState] = useState<T>(function () {
    return readCookieValue(key, initialValue);
  });

  useEffect(
    function () {
      setValueState(readCookieValue(key, initialRef.current));
    },
    [key],
  );

  const setValue = useCallback(
    function (next: T) {
      setValueState(next);
      writeCookieValue(key, next, initialRef.current);
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

  return [value, setValue, remove] as const;
}

function readCookieValue<T>(key: string, initialValue: T): T {
  if (!canUseDOM()) return initialValue;

  const raw = getCookieRaw(key);
  if (raw === null) return initialValue;

  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return initialValue;
  }

  return deserialize(decoded, initialValue);
}

function writeCookieValue<T>(key: string, value: T, initialValue: T): void {
  if (!canUseDOM()) return;

  const serialized = serialize(value, initialValue);

  if (serialized === null) {
    deleteCookie(key);
    return;
  }

  setCookieRaw(key, serialized);
}

function serialize<T>(value: T, initialValue: T): string | null {
  if (value === undefined) return null;

  if (typeof initialValue === "string") return String(value);

  if (typeof initialValue === "bigint") {
    return (value as unknown as bigint).toString();
  }

  if (initialValue instanceof Date) {
    return (value as unknown as Date).toISOString();
  }

  try {
    const json = JSON.stringify(value);
    return typeof json === "string" ? json : null;
  } catch {
    return null;
  }
}

function deserialize<T>(raw: string, initialValue: T): T {
  if (typeof initialValue === "string") return raw as unknown as T;

  if (typeof initialValue === "bigint") {
    try {
      return BigInt(raw) as unknown as T;
    } catch {
      return initialValue;
    }
  }

  if (initialValue instanceof Date) {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return initialValue;
    return d as unknown as T;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    if (typeof initialValue === "number") {
      const n = Number(raw);
      return Number.isFinite(n) ? (n as unknown as T) : initialValue;
    }

    if (typeof initialValue === "boolean") {
      if (raw === "true") return true as unknown as T;
      if (raw === "false") return false as unknown as T;
    }

    return initialValue;
  }
}

function canUseDOM(): boolean {
  return typeof document !== "undefined" && typeof document.cookie === "string";
}

function getCookieRaw(name: string): string | null {
  const encodedName = encodeURIComponent(name);

  const all = document.cookie;
  if (!all) return null;

  const parts = all.split(";");
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!.trim();
    if (!part) continue;

    const eqIndex = part.indexOf("=");
    if (eqIndex === -1) continue;

    const k = part.slice(0, eqIndex);
    if (k !== encodedName) continue;

    return part.slice(eqIndex + 1);
  }

  return null;
}

function setCookieRaw(name: string, value: string): void {
  const encodedName = encodeURIComponent(name);
  const encodedValue = encodeURIComponent(value);

  const parts: string[] = [];
  parts.push(encodedName + "=" + encodedValue);
  parts.push("Path=/");
  parts.push("SameSite=Lax");
  if (isLikelyHttps()) parts.push("Secure");

  document.cookie = parts.join("; ");
}

function deleteCookie(name: string): void {
  if (!canUseDOM()) return;

  const parts: string[] = [];
  parts.push(encodeURIComponent(name) + "=");
  parts.push("Path=/");
  parts.push("SameSite=Lax");
  parts.push("Max-Age=0");
  if (isLikelyHttps()) parts.push("Secure");

  document.cookie = parts.join("; ");
}

function isLikelyHttps(): boolean {
  return typeof location !== "undefined" && location.protocol === "https:";
}
