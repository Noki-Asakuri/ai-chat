import { Axiom } from "@axiomhq/js";
import { AxiomJSTransport, Logger } from "@axiomhq/logging";

import { env } from "@/env";

const axiomClient = new Axiom({ token: env.VITE_AXIOM_TOKEN });

const axiomLogger = new Logger({
  transports: [new AxiomJSTransport({ axiom: axiomClient, dataset: env.VITE_AXIOM_DATASET })],
});

type LogParams = Parameters<typeof axiomLogger.info>;

export const logger = {
  info: function (...args: LogParams) {
    console.log(...args);
    axiomLogger.info(...args);
  },
  error: function (...args: LogParams) {
    console.error(...args);
    axiomLogger.error(...args);
  },
  warn: function (...args: LogParams) {
    console.warn(...args);
    axiomLogger.warn(...args);
  },
};
