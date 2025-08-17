import "server-only";

import type { NextRequest } from "next/server";

import axiomClient from "@/lib/axiom/axiom";
import { AxiomJSTransport, Logger } from "@axiomhq/logging";
import { createAxiomRouteHandler, nextJsFormatters } from "@axiomhq/nextjs";

import { env } from "@/env";

export const logger = new Logger({
  transports: [
    new AxiomJSTransport({ axiom: axiomClient, dataset: env.NEXT_PUBLIC_AXIOM_DATASET }),
  ],
  formatters: nextJsFormatters,
});

export const withAxiom = createAxiomRouteHandler(logger, {
  store: (req: NextRequest) => {
    return {
      request_id: crypto.randomUUID(),
      trace_id: req.headers.get("x-trace-id"),
    };
  },
});
