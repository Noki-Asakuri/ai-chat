import { isRedirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { deleteCookie, getResponseHeaders } from "@tanstack/react-start/server";
import { signOut } from "@workos/authkit-tanstack-react-start";
import { DEFAULT_STORAGE_KEY } from "convex-helpers/react/sessions";
import { AVATAR_COOKIE_NAME } from "@/lib/authkit/avatar-cache";

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  deleteCookie(DEFAULT_STORAGE_KEY);
  deleteCookie(AVATAR_COOKIE_NAME, { path: "/" });

  try {
    await signOut();
  } catch (error) {
    if (isRedirect(error)) {
      for (const cookie of getResponseHeaders().getSetCookie()) {
        error.headers.append("set-cookie", cookie);
      }
    }

    throw error;
  }
});
