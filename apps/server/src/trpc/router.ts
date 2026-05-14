import { type inferRouterInputs, type inferRouterOutputs } from "@trpc/server";

import { publicProcedure, router } from ".";
import { threadRouter } from "./routers/threads";

export const appRouter = router({
  thread: threadRouter,

  healthCheck: publicProcedure.query(function (ctx) {
    return "OK";
  }),
});

export type AppRouter = typeof appRouter;

export type RouterInput = inferRouterInputs<AppRouter>;
export type RouterOutput = inferRouterOutputs<AppRouter>;
