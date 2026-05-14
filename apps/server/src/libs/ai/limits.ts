import { api } from "@ai-chat/backend/convex/_generated/api";

import { Result, TaggedError } from "better-result";
import type { Context } from "hono";

import { createServerConvexClient } from "@/libs/convex";

type UserPointsUsage = {
  allowed: boolean;
  used: number;
  base: number;
  resetType: string;
};

export class LimitReachError extends TaggedError("UserMessageLimitReachedError")<{
  message: string;
  usage: UserPointsUsage;
}>() {}

export class RefundError extends TaggedError("RefundError")<{
  userId: string;
  cause: unknown;
}>() {}

export function getUserPointsLimitMessage(usage: { used: number; base: number; resetType: string }): string {
  const resetWindowLabel = usage.resetType === "daily" ? "Daily" : "Monthly";
  return `${resetWindowLabel} message limit reached (${usage.used}/${usage.base}).`;
}

export async function consumeUserPoints(
  ctx: Context,
  amount = 1,
): Promise<Result<UserPointsUsage, LimitReachError>> {
  const convexClient = await createServerConvexClient(ctx);
  const usage = await convexClient.mutation(api.functions.usages.checkAndIncrement, { amount });

  if (usage.allowed) {
    return Result.ok(usage);
  }

  return Result.err(new LimitReachError({ message: getUserPointsLimitMessage(usage), usage }));
}

export async function refundUserPoints(ctx: Context, amount = 1): Promise<Result<null, RefundError>> {
  const convexClient = await createServerConvexClient(ctx);
  const auth = ctx.get("auth");

  return Result.tryPromise({
    try: async () => await convexClient.mutation(api.functions.usages.refundRequest, { amount }),
    catch: (cause) => new RefundError({ cause, userId: auth.userId }),
  });
}
