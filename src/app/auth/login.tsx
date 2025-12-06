import { createFileRoute, redirect } from "@tanstack/react-router";

import { getSignInUrl } from "@/lib/authkit/serverFunctions";

export const Route = createFileRoute("/auth/login")({
  beforeLoad: async ({ context, location }) => {
    if (context.user) throw redirect({ to: "/" });

    const href = await getSignInUrl({ data: location.pathname });
    throw redirect({ href });
  },
});
