import { TRPCError } from "@trpc/server";
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";

import { Context as HonoContext } from "hono";

import type { ServerAuthContext } from "../middlewares/workos-authenticate";
import { getAuthContextResultFromRequest } from "../middlewares/workos-authenticate";

type TRPCContext = {
  auth: ServerAuthContext;
  resHeaders: Headers;
  honoCtx: HonoContext;
};

export async function createContext(
  options: FetchCreateContextFnOptions,
  honoCtx: HonoContext,
): Promise<TRPCContext> {
  const authResult = await getAuthContextResultFromRequest(options.req);

  if (authResult.isErr()) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: authResult.error.message });
  }

  return { auth: authResult.value, resHeaders: options.resHeaders, honoCtx };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
