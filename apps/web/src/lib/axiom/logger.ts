import { Axiom } from "@axiomhq/js";
import { AxiomJSTransport, Logger } from "@axiomhq/logging";

import { env } from "@/env";

const axiom = new Axiom({ token: env.VITE_AXIOM_TOKEN });

const axiomLogger = new Logger({
  transports: [new AxiomJSTransport({ axiom, dataset: env.VITE_AXIOM_DATASET })],
});

export const logger = {
  debug: function (...args: Parameters<typeof axiomLogger.debug>) {
    console.debug(...args);
    axiomLogger.debug(...args);
  },
  info: function (...args: Parameters<typeof axiomLogger.info>) {
    console.log(...args);
    axiomLogger.info(...args);
  },
  error: function (...args: Parameters<typeof axiomLogger.error>) {
    console.error(...args);
    axiomLogger.error(...args);
  },
  warn: function (...args: Parameters<typeof axiomLogger.warn>) {
    console.warn(...args);
    axiomLogger.warn(...args);
  },
};
