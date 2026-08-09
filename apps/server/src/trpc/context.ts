import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";

import { Context as HonoContext } from "hono";

import type { ServerAuthContext } from "../middlewares/workos-authenticate";

type TRPCContext = {
  auth: ServerAuthContext;
  resHeaders: Headers;
  honoCtx: HonoContext;
};

export async function createContext(
  options: FetchCreateContextFnOptions,
  honoCtx: HonoContext,
): Promise<TRPCContext> {
  return { auth: honoCtx.get("auth"), resHeaders: options.resHeaders, honoCtx };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
