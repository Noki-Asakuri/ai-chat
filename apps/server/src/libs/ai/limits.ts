import { api } from "@ai-chat/backend/convex/_generated/api";

import { Result, TaggedError } from "better-result";

import { createServerConvexClient } from "@/libs/convex";

type ServerConvexClient = Awaited<ReturnType<typeof createServerConvexClient>>;

type UserPointsUsage = {
  allowed: boolean;
  used: number;
  base: number;
  resetType: string;
};

export class UserMessageLimitReachedError extends TaggedError("UserMessageLimitReachedError")<{
  message: string;
  usage: UserPointsUsage;
}>() {}

export function getUserPointsLimitMessage(usage: {
  used: number;
  base: number;
  resetType: string;
}): string {
  const resetWindowLabel = usage.resetType === "daily" ? "Daily" : "Monthly";
  return `${resetWindowLabel} message limit reached (${usage.used}/${usage.base}).`;
}

export async function consumeUserPoints({
  convexClient,
  amount = 1,
}: {
  convexClient: ServerConvexClient;
  amount?: number;
}): Promise<Result<UserPointsUsage, UserMessageLimitReachedError>> {
  const usage = await convexClient.mutation(api.functions.usages.checkAndIncrement, { amount });

  if (usage.allowed) {
    return Result.ok(usage);
  }

  return Result.err(
    new UserMessageLimitReachedError({ message: getUserPointsLimitMessage(usage), usage }),
  );
}

export async function refundUserPoints({
  convexClient,
  amount = 1,
}: {
  convexClient: ServerConvexClient;
  amount?: number;
}): Promise<void> {
  await convexClient.mutation(api.functions.usages.refundRequest, { amount });
}
