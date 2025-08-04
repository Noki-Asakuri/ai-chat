"use client";

import { Logger, ProxyTransport } from "@axiomhq/logging";
import { nextJsFormatters } from "@axiomhq/nextjs/client";
import { createUseLogger, createWebVitalsComponent } from "@axiomhq/react";

export const logger = new Logger({
  transports: [new ProxyTransport({ url: "/api/axiom", autoFlush: true })],
  formatters: nextJsFormatters,
});

const useLogger = createUseLogger(logger);
const WebVitals = createWebVitalsComponent(logger);

export { useLogger, WebVitals };
