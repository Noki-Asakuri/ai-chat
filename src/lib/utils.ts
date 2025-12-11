/* eslint-disable @typescript-eslint/unbound-method */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

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
  // If you're dealing with 0 bytes, you get 0 bytes. Math is fun.
  if (bytes === 0) {
    return "0 B";
  }

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

/**
 * A tuple representing the result of an operation that can fail.
 * On success, the tuple is `[data, null]`.
 * On failure, the tuple is `[null, error]`.
 * @template T The type of the data on success.
 * @template E The type of the error on failure, defaults to `Error`.
 */
export type GoResult<T, E = Error> = [T, null] | [null, E];

/**
 * Wraps an async function (a function that returns a Promise) in a try/catch block.
 * This allows for Go-style error handling.
 *
 * @template T The type of the data the Promise resolves to.
 * @param {() => Promise<T>} promiseFn The function that returns the Promise to be executed.
 * @returns {Promise<GoResult<T>>} A Promise that resolves to a tuple: `[data, null]` on success, or `[null, error]` on failure.
 */
export async function tryCatch<T>(
  promiseFn: (() => Promise<T>) | Promise<T>,
): Promise<GoResult<T>> {
  try {
    const data = await (typeof promiseFn === "function" ? promiseFn() : promiseFn);
    return [data, null];
  } catch (error) {
    // Ensure the error is a proper Error object
    if (error instanceof Error) {
      return [null, error];
    }
    // Handle cases where a non-Error is thrown (e.g., throw "a string")
    return [null, new Error(String(error))];
  }
}

/**
 * Wraps a synchronous function in a try/catch block.
 * This allows for Go-style error handling for synchronous code.
 *
 * @template T The return type of the function.
 * @param {() => T} fn The synchronous function to be executed.
 * @returns {GoResult<T>} A tuple: `[data, null]` on success, or `[null, error]` on failure.
 */
export function tryCatchSync<T>(fn: () => T): GoResult<T> {
  try {
    const data = fn();
    return [data, null];
  } catch (error) {
    if (error instanceof Error) {
      return [null, error];
    }
    return [null, new Error(String(error))];
  }
}

export function fixMarkdownCodeBlocks(markdownText: string): string {
  const codeBlockRegex = /([\w])```/g;

  return markdownText.replace(codeBlockRegex, (match, group1) => {
    return `${group1}\n\`\`\``;
  });
}

/**
 * Returns the first non-empty string from the given arguments, in order.
 * All arguments before the final one are optional; the final argument is required
 * and is returned as a fallback even if it's empty.
 *
 * @param strings - A sequence of optional strings followed by a required final string (fallback).
 * @returns The first string with length > 0, or the last argument if none are non-empty.
 *
 * @example
 * firstNonEmptyOrLast(undefined, "", "hello", "fallback"); // "hello"
 *
 * @example
 * firstNonEmptyOrLast(undefined, "", ""); // ""
 *
 * @example
 * firstNonEmptyOrLast("value"); // "value"
 */
export function firstNonEmptyOrLast(...strings: [...(string | undefined)[], string]): string {
  const last = strings[strings.length - 1]!;

  for (let i = 0; i < strings.length - 1; i++) {
    const s = strings[i];
    if (s && s.length > 0) return s;
  }

  return last;
}

export const format = {
  number: numberFormat.format,
  time: timeFormat.format,
  date: dateFormat.format,
  size: formatBytes,
};
