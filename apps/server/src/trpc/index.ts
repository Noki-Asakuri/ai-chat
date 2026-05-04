import { initTRPC } from "@trpc/server";

import type { Context } from "./context";

const t = initTRPC.context<Context>().create();

export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async function enforceAuth(options) {
  const result = await options.next({ ctx: options.ctx });

  const pendingSetCookieHeader = options.ctx.auth.flushPendingSetCookieHeader();
  if (pendingSetCookieHeader) {
    options.ctx.resHeaders.append("Set-Cookie", pendingSetCookieHeader);
  }

  return result;
});

export const router = t.router;
