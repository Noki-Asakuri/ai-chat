import { useEffect } from "react";
import z from "zod";

import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { getConfig } from "@/lib/authkit/ssr/config";
import { saveSession } from "@/lib/authkit/ssr/session";
import { getWorkOS } from "@/lib/authkit/ssr/workos";

const workOSCallbackHandler = createServerFn({ method: "GET" })
  .inputValidator(z.object({ code: z.string(), state: z.string() }))
  .handler(async ({ data }) => {
    const { code, state } = data;
    let returnPathname = state && state !== "null" ? JSON.parse(atob(state)).returnPathname : null;

    if (!code) {
      return {
        error: {
          error_code: "missing_code",
          message: "Something went wrong",
          description:
            "Couldn't sign in. If you are not sure what happened, please contact your organization admin.",
        },
      };
    }

    try {
      // Use the code returned to us by AuthKit and authenticate the user with WorkOS
      const { accessToken, refreshToken, user, impersonator } =
        await getWorkOS().userManagement.authenticateWithCode({
          clientId: getConfig("clientId"),
          code,
        });

      if (!accessToken || !refreshToken) throw new Error("response is missing tokens");
      await saveSession({ accessToken, refreshToken, user, impersonator });

      return { status: "ok", refreshToken, accessToken };
    } catch (error) {
      const errorRes = {
        error: error instanceof Error ? error.message : String(error),
      };

      console.error(errorRes);

      return {
        error: {
          error_code: "unknown_error",
          message: "Something went wrong",
          description:
            "Couldn't sign in. If you are not sure what happened, please contact your organization admin.",
        },
      };
    }
  });

export const Route = createFileRoute("/api/client/auth/callback")({
  preload: false,
  loader: async ({ location }) => {
    const { code, state } = location.search as { code: string; state: string };
    return await workOSCallbackHandler({ data: { code, state } });
  },

  component: HandlerComponent,
});

function HandlerComponent() {
  const loaderData = Route.useLoaderData();

  useEffect(() => {
    if (loaderData?.error) {
      console.error(loaderData.error);
    }

    if (loaderData.status === "ok") {
      if (import.meta.env.DEV) {
        localStorage.setItem("workos:refresh-token", loaderData.refreshToken);
        localStorage.setItem("workos:access-token", loaderData.accessToken);
      }

      throw redirect({ to: "/" });
    }
  }, [loaderData]);

  if (!loaderData?.error) return null;

  return <div>{loaderData.error.message}</div>;
}
