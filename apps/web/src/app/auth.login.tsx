import { createFileRoute } from "@tanstack/react-router";
import { getAuth, getSignInUrl } from "@workos/authkit-tanstack-react-start";

import { authReturnSearchSchema, getSafeAuthReturnPath } from "@/lib/authkit/redirect";

export const Route = createFileRoute("/auth/login")({
  validateSearch: authReturnSearchSchema,

  server: {
    handlers: {
      GET: async function ({ request }) {
        const { user } = await getAuth();

        const url = new URL(request.url);
        const returnPath = getSafeAuthReturnPath(url.searchParams.get("rt"));

        if (user) {
          return Response.redirect(new URL(returnPath, url.origin), 307);
        }

        const signInUrl = await getSignInUrl({
          data: { prompt: "login", returnPathname: returnPath },
        });
        return Response.redirect(signInUrl, 307);
      },
    },
  },
});
