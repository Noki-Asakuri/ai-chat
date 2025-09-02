import type { Instrumentation } from "next";

import { transformOnRequestError } from "@axiomhq/nextjs";
import { logger } from "@/lib/axiom/server";

export const onRequestError: Instrumentation.onRequestError = async (error, request, ctx) => {
  logger.error(...transformOnRequestError(error, request, ctx));
  await logger.flush();
};
