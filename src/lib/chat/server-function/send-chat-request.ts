import { createServerFn, createMiddleware } from "@tanstack/react-start";
import { redirect } from "@tanstack/react-router";

import type { ChatRequestBody } from "@/lib/types";

const sendChatMiddleware = createMiddleware({ type: "function" }).client(async ({ next }) => {
  return next();
});

export const sendChatRequest = createServerFn({ method: "POST" })
  .middleware([sendChatMiddleware])
  .handler(async ({ data, context }) => {
    console.log(data, context);
  });
