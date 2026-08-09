import { z } from "zod";

import { createFileRoute, redirect } from "@tanstack/react-router";
import { getAuth } from "@workos/authkit-tanstack-react-start";

import { terminateSession } from "@/lib/authkit/server-fn";

export const rtSearchSchema = z.object({ rt: z.string().optional() });

export const Route = createFileRoute("/auth/logout")({
  preload: false,

  loader: async ({ location }) => {
    const rt = rtSearchSchema.parse(location.search).rt ?? "/";
    const returnPath = `/auth/login?rt=${encodeURIComponent(rt)}`;

    const auth = await getAuth();
    if (!auth.user) throw redirect({ to: "/auth/login", search: { rt } });
    await terminateSession({ data: { returnTo: returnPath, sessionId: auth.sessionId } });
  },
});
