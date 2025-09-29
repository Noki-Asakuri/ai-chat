import { AxiomJSTransport, Logger } from "@axiomhq/logging";
import axiomClient from "./axiom";

import { env } from "@/env";

export const logger = new Logger({
  transports: [
    new AxiomJSTransport({ axiom: axiomClient, dataset: env.NEXT_PUBLIC_AXIOM_DATASET }),
  ],
});
