import { isRedirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { deleteCookie, getResponseHeader } from "@tanstack/react-start/server";
import { signOut } from "@workos/authkit-tanstack-react-start";
import { DEFAULT_STORAGE_KEY } from "convex-helpers/react/sessions";

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  deleteCookie(DEFAULT_STORAGE_KEY);

  try {
    await signOut();
  } catch (error) {
    const deletedCookie = getResponseHeader("set-cookie");
    if (isRedirect(error) && deletedCookie) {
      error.headers.append("set-cookie", deletedCookie);
    }

    throw error;
  }
});
