import type { Context } from "hono";

import { refundUserPoints } from "@/libs/ai/limits";
import { logger } from "@/libs/axiom";

type RefundReservedUsageOptions = {
  userId: string;
  requestId: string;
  threadId: string;
  assistantMessageId: string;
  reason: string;
  error?: unknown;
};

export function createReservedUsageRefunder(ctx: Context) {
  let usageRefunded = false;

  return async function refundReservedUsage(options: RefundReservedUsageOptions): Promise<void> {
    if (usageRefunded) return;

    const result = await refundUserPoints(ctx);
    if (result.isOk()) {
      usageRefunded = true;
      return;
    }

    logger.error("[Chat Error]: Failed to refund usage", {
      userId: options.userId,
      requestId: options.requestId,
      threadId: options.threadId,
      reason: options.reason,
      error: options.error,
      refundError: result.error,
    });
  };
}
