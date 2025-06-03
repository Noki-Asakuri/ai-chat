import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

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
