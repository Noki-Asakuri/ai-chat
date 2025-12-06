import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";

import axiomClient from "@/lib/axiom/axiom";
import { AxiomJSTransport, Logger } from "@axiomhq/logging";

import { env } from "@/env";

export const logger = new Logger({
  transports: [new AxiomJSTransport({ axiom: axiomClient, dataset: env.VITE_AXIOM_DATASET })],
});
