import { createFileRoute, redirect } from "@tanstack/react-router";
import { getAuth, getSignInUrl } from "@workos/authkit-tanstack-react-start";

import { rtSearchSchema } from "./auth.logout";

export const Route = createFileRoute("/auth/login")({
  preload: false,

  loader: async ({ location }) => {
    const { user } = await getAuth();
    const rt = rtSearchSchema.parse(location.search).rt ?? "/";

    if (user) {
      console.log("[Auth] User is already authenticated", { user });
      throw redirect({ to: rt });
    }

    console.log("[Auth] Redirecting to sign in", { rt });
    const signInUrl = await getSignInUrl({ data: { prompt: "login", returnPathname: rt } });
    throw redirect({ href: signInUrl, throw: true, reloadDocument: true });
  },
});
