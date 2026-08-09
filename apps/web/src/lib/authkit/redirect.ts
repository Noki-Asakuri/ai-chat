import { z } from "zod";

const AUTH_RETURN_URL_BASE = "https://auth-return.local";

export function getSafeAuthReturnPath(value: string | null | undefined): string {
  if (!value?.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/";

  try {
    const url = new URL(value, AUTH_RETURN_URL_BASE);
    if (url.origin !== AUTH_RETURN_URL_BASE) return "/";

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

export const authReturnSearchSchema = z
  .object({ rt: z.string().optional(), maxAge: z.literal("300").optional() })
  .transform(({ rt, maxAge }) => ({ rt: getSafeAuthReturnPath(rt), maxAge }));
