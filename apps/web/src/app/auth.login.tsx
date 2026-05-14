import { createFileRoute } from "@tanstack/react-router";
import { getAuth, getSignInUrl } from "@workos/authkit-tanstack-react-start";

import { rtSearchSchema } from "@/app/auth.logout";

export const Route = createFileRoute("/auth/login")({
  server: {
    handlers: {
      GET: async function ({ request }) {
        const { user } = await getAuth();

        const url = new URL(request.url);
        const rt = rtSearchSchema.parse(url.searchParams).rt ?? "/";

        if (user) {
          console.log("[Auth] User is already authenticated", { user });
          return new Response(null, { status: 307, headers: { Location: rt } });
        }

        console.log("[Auth] Redirecting to sign in", { rt });
        const signInUrl = await getSignInUrl({ data: { prompt: "login", returnPathname: rt } });
        return new Response(null, { status: 307, headers: { Location: signInUrl } });
      },
    },
  },
});
