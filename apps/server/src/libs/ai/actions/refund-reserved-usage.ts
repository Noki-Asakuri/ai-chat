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
  let refundInFlight: Promise<void> | null = null;

  return function refundReservedUsage(options: RefundReservedUsageOptions): Promise<void> {
    if (usageRefunded) return Promise.resolve();
    if (refundInFlight) return refundInFlight;

    refundInFlight = (async function refundUsage(): Promise<void> {
      try {
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
      } finally {
        refundInFlight = null;
      }
    })();

    return refundInFlight;
  };
}
