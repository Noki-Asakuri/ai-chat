import { createIsomorphicFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";

import { buildImageAssetUrl, getImageAssetPathFromUrl } from "@/lib/assets/urls";

export const AVATAR_COOKIE_NAME = "user-avatar";

const avatarKeyPattern = /^user_[a-zA-Z0-9]+\/avatar\/[a-f0-9-]{36}\.(jpeg|jpg|png|webp)$/;

const readAvatarCookie = createIsomorphicFn()
  .server(() => getCookie(AVATAR_COOKIE_NAME))
  .client(() => {
    try {
      const cookie = document.cookie
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${AVATAR_COOKIE_NAME}=`));
      if (!cookie) return undefined;

      return decodeURIComponent(cookie.slice(AVATAR_COOKIE_NAME.length + 1));
    } catch {
      return undefined;
    }
  });

/** Only accept this user's avatar keys; cookies are untrusted display hints. */
export function getCachedAvatarUrl(userId: string): string | undefined {
  const key = readAvatarCookie();
  if (!key || !key.startsWith(`${userId}/avatar/`) || !avatarKeyPattern.test(key)) return undefined;

  return buildImageAssetUrl(key);
}

export function cacheUserAvatar(userId: string, imageUrl: string | null | undefined): void {
  const key = imageUrl ? getImageAssetPathFromUrl(imageUrl) : null;
  const validKey = key && key.startsWith(`${userId}/avatar/`) && avatarKeyPattern.test(key) ? key : "";
  const secure = location.protocol === "https:" ? "; Secure" : "";

  try {
    document.cookie = `${AVATAR_COOKIE_NAME}=${encodeURIComponent(validKey)}; Path=/; SameSite=Lax; Max-Age=${validKey ? 60 * 60 * 24 * 30 : 0}${secure}`;
  } catch {
    // Blocked cookie storage must not turn a successful profile save into an error.
  }
}
