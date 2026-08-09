import { createFileRoute } from "@tanstack/react-router";
import { getSignInUrl } from "@workos/authkit-tanstack-react-start";

import { authReturnSearchSchema, getSafeAuthReturnPath } from "@/lib/authkit/redirect";

export const Route = createFileRoute("/auth/login")({
  validateSearch: authReturnSearchSchema,

  server: {
    handlers: {
      GET: async function ({ request }) {
        const url = new URL(request.url);
        const returnPath = getSafeAuthReturnPath(url.searchParams.get("rt"));
        const maxAge = url.searchParams.get("maxAge") === "300" ? 300 : undefined;

        const signInUrl = await getSignInUrl({
          data: { prompt: "login", returnPathname: returnPath, maxAge },
        });
        return Response.redirect(signInUrl, 307);
      },
    },
  },
});
