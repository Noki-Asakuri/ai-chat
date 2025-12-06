import { Logger, ProxyTransport } from "@axiomhq/logging";

export const logger = new Logger({
  transports: [new ProxyTransport({ url: "/api/axiom", autoFlush: true })],
});
