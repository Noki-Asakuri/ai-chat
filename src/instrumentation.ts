import type { Instrumentation } from "next";

import * as Sentry from "@sentry/nextjs";
import { transformOnRequestError } from "@axiomhq/nextjs";
import { logger } from "@/lib/axiom/server";

export async function register() {
  // Skip in development
  if (process.env.NODE_ENV === "development") return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, ctx) => {
  Sentry.captureRequestError(error, request, ctx);
  logger.error(...transformOnRequestError(error, request, ctx));

  await logger.flush();
};
