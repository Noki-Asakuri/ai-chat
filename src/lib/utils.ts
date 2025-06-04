/* eslint-disable @typescript-eslint/unbound-method */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

const numberFormat = new Intl.NumberFormat("en-US", {
  style: "unit",
  unit: "second",
  unitDisplay: "narrow",
  maximumFractionDigits: 1,
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function toUUID(str: string) {
  if (str.length !== 32) throw new Error("Invalid UUID");

  return [str.slice(0, 8), str.slice(8, 12), str.slice(12, 16), str.slice(16, 20), str.slice(20, 32)].join("-");
}

export function fromUUID<T extends string>(uuid?: string | null) {
  return uuid?.replaceAll("-", "") as T | undefined;
}

export const format = {
  number: numberFormat.format,
};
