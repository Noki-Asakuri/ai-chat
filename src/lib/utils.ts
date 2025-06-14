/* eslint-disable @typescript-eslint/unbound-method */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

const numberFormat = new Intl.NumberFormat("en-US");
const sizeFormat = new Intl.NumberFormat("en-US", {
  style: "unit",
  unit: "kilobyte",
  unitDisplay: "narrow",
  maximumFractionDigits: 2,
});

const timeFormat = new Intl.NumberFormat("en-US", {
  style: "unit",
  unit: "second",
  unitDisplay: "narrow",
  maximumFractionDigits: 2,
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

export function fromUUID<T extends string>(uuid?: string | null) {
  return uuid?.replaceAll("-", "") as T | undefined;
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
export async function tryCatch<T>(promiseFn: () => Promise<T>): Promise<GoResult<T>> {
  try {
    const data = await promiseFn();
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

export const format = {
  number: numberFormat.format,
  time: timeFormat.format,
  size: sizeFormat.format,
};
