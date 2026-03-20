import { z } from "zod";

import { createFileRoute, redirect } from "@tanstack/react-router";
import { getAuth } from "@workos/authkit-tanstack-react-start";

import { terminateSession } from "@/lib/authkit/server-fn";

export const rtSearchSchema = z.object({ rt: z.string().optional() });

export const Route = createFileRoute("/auth/logout")({
  preload: false,

  loader: async ({ location }) => {
    const auth = await getAuth();

    const rt = rtSearchSchema.parse(location.search).rt ?? "/";
    const returnPath = "/auth/login?rt=" + rt;

    if (!auth || !auth.user) throw redirect({ to: returnPath, throw: true, reloadDocument: true });
    await terminateSession({ data: { returnTo: returnPath, sessionId: auth.sessionId } });
  },
});
