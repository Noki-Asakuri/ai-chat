import { useCallback, useEffect, useRef, useState } from "react";

export type UseStorage<T> = (
  key: string,
  initialValue: T,
) => readonly [T, (value: T) => void] | readonly [T, (value: T) => void, () => void];

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

  var raw = getCookieRaw(key);
  if (raw === null) return initialValue;

  var decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return initialValue;
  }

  return deserialize(decoded, initialValue);
}

function writeCookieValue<T>(key: string, value: T, initialValue: T): void {
  if (!canUseDOM()) return;

  var serialized = serialize(value, initialValue);

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
    var json = JSON.stringify(value);
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
    var d = new Date(raw);
    if (Number.isNaN(d.getTime())) return initialValue;
    return d as unknown as T;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    if (typeof initialValue === "number") {
      var n = Number(raw);
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
  var encodedName = encodeURIComponent(name);

  var all = document.cookie;
  if (!all) return null;

  var parts = all.split(";");
  for (var i = 0; i < parts.length; i++) {
    var part = parts[i]!.trim();
    if (!part) continue;

    var eqIndex = part.indexOf("=");
    if (eqIndex === -1) continue;

    var k = part.slice(0, eqIndex);
    if (k !== encodedName) continue;

    return part.slice(eqIndex + 1);
  }

  return null;
}

function setCookieRaw(name: string, value: string): void {
  var encodedName = encodeURIComponent(name);
  var encodedValue = encodeURIComponent(value);

  var parts: string[] = [];
  parts.push(encodedName + "=" + encodedValue);
  parts.push("Path=/");
  parts.push("SameSite=Lax");
  if (isLikelyHttps()) parts.push("Secure");

  document.cookie = parts.join("; ");
}

function deleteCookie(name: string): void {
  if (!canUseDOM()) return;

  var parts: string[] = [];
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
