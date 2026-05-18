import { tryCatch, tryCatchSync } from "@ai-chat/shared/utils/async";

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const BYTE_UNITS = ["byte", "kilobyte", "megabyte", "gigabyte"] as const;
type ByteUnit = (typeof BYTE_UNITS)[number];

const defaultByteFormatters: Record<ByteUnit, Intl.NumberFormat> = {
  byte: new Intl.NumberFormat("en-US", {
    style: "unit",
    unit: "byte",
    unitDisplay: "short",
    maximumFractionDigits: 2,
  }),
  kilobyte: new Intl.NumberFormat("en-US", {
    style: "unit",
    unit: "kilobyte",
    unitDisplay: "short",
    maximumFractionDigits: 2,
  }),
  megabyte: new Intl.NumberFormat("en-US", {
    style: "unit",
    unit: "megabyte",
    unitDisplay: "short",
    maximumFractionDigits: 2,
  }),
  gigabyte: new Intl.NumberFormat("en-US", {
    style: "unit",
    unit: "gigabyte",
    unitDisplay: "short",
    maximumFractionDigits: 2,
  }),
};

const byteFormatters = new Map<string, Intl.NumberFormat>();

function createByteFormatter(locale: string, unit: ByteUnit): Intl.NumberFormat {
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit,
    unitDisplay: "short", // This gives us 'MB' instead of 'megabytes'
    maximumFractionDigits: 2,
  });
}

function getByteFormatter(locale: string, unit: ByteUnit): Intl.NumberFormat {
  if (locale === "en-US") return defaultByteFormatters[unit];

  const key = `${locale}:${unit}`;
  const cached = byteFormatters.get(key);
  if (cached) return cached;

  const formatter = createByteFormatter(locale, unit);
  byteFormatters.set(key, formatter);
  return formatter;
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
  let unit: ByteUnit;

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

  const formatter = getByteFormatter(locale, unit);

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
