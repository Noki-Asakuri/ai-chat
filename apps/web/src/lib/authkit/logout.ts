import { createServerFn } from "@tanstack/react-start";
import { deleteCookie } from "@tanstack/react-start/server";
import { getAuth, getAuthkit } from "@workos/authkit-tanstack-react-start";
import { DEFAULT_STORAGE_KEY } from "convex-helpers/react/sessions";
import { AVATAR_COOKIE_NAME } from "@/lib/authkit/avatar-cache";

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  deleteCookie(DEFAULT_STORAGE_KEY);
  deleteCookie(AVATAR_COOKIE_NAME, { path: "/" });

  const auth = await getAuth();
  if (!auth.user || !auth.sessionId) return { url: "/" };

  const authKit = await getAuthkit();
  const { logoutUrl } = await authKit.signOut(auth.sessionId);
  // Return data so cookie middleware cannot turn the RPC into an HTTP redirect.
  return { url: logoutUrl };
});
