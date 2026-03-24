import { tryCatch, tryCatchSync } from "@ai-chat/shared/utils/async";

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function toUUID(str: string) {
  if (str.length !== 32) throw new Error("Invalid UUID");
  return [
    str.slice(0, 8),
    str.slice(8, 12),
    str.slice(12, 16),
    str.slice(16, 20),
    str.slice(20, 32),
  ].join("-");
}

export function fromUUID<T extends string>(uuid: T | string): T;
export function fromUUID<T extends string>(uuid: T | string | null): T | null;
export function fromUUID<T extends string>(uuid: T | string | undefined): T | undefined;

export function fromUUID<T extends string>(uuid?: T | string | null) {
  return uuid?.replaceAll("-", "") as T | undefined;
}

/**
 * Formats a number of bytes into a human-readable string with units (KB, MB, GB).
 *
 * @param bytes The number of bytes to format.
 * @param locale A locale string (e.g., 'en-US', 'de-DE') for number formatting.
 * @returns A formatted string like "5.37 MB".
 */
function formatBytes(bytes: number, locale = "en-US"): string {
  if (bytes === 0) return "0 B";

  const KILOBYTE = 1024;
  const MEGABYTE = KILOBYTE * 1024;
  const GIGABYTE = MEGABYTE * 1024;

  let value: number;
  let unit: "gigabyte" | "megabyte" | "kilobyte" | "byte";

  // Figure out the best unit to use
  if (bytes >= GIGABYTE) {
    value = bytes / GIGABYTE;
    unit = "gigabyte";
  } else if (bytes >= MEGABYTE) {
    value = bytes / MEGABYTE;
    unit = "megabyte";
  } else if (bytes >= KILOBYTE) {
    value = bytes / KILOBYTE;
    unit = "kilobyte";
  } else {
    value = bytes;
    unit = "byte";
  }

  // The Intl.NumberFormat wizard does the rest
  const formatter = new Intl.NumberFormat(locale, {
    style: "unit",
    unit: unit,
    unitDisplay: "short", // This gives us 'MB' instead of 'megabytes'
    maximumFractionDigits: 2,
  });

  return formatter.format(value);
}

const numberFormat = new Intl.NumberFormat("en-US");
const timeFormat = new Intl.NumberFormat("en-US", {
  style: "unit",
  unit: "second",
  unitDisplay: "narrow",
  maximumFractionDigits: 2,
});

const dateFormat = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export const format = {
  number: numberFormat.format,
  time: timeFormat.format,
  date: dateFormat.format,
  size: formatBytes,
};

export { tryCatch, tryCatchSync };
