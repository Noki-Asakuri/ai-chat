import { networkInterfaces } from "node:os";

import { Result } from "better-result";
import type { Context, Next } from "hono";

import { env } from "../env";
import { logger } from "./axiom";

const ANSI = {
  reset: "\u001b[0m",
  bold: "\u001b[1m",
  dim: "\u001b[2m",
  green: "\u001b[32m",
  cyan: "\u001b[36m",
} as const;

const serverStartedAt = Date.now();
const commitSha = await getCommitSha();

const canUseColor = process.stdout.isTTY && process.env.NO_COLOR === undefined;

let shuttingDown = false;
let activeRequests = 0;

async function getCommitSha(): Promise<string> {
  const envSha = process.env.GIT_COMMIT_SHA || process.env.COMMIT_SHA;
  if (envSha && envSha.length > 0) return envSha;

  const result = await Result.tryPromise(async () => Bun.$`git rev-parse --short=12 HEAD`.text());
  return result.match({ ok: (sha) => sha.trim().slice(0, 5), err: () => "unknown" });
}

function colorize(text: string, ...codes: string[]): string {
  if (!canUseColor || codes.length === 0) return text;
  return `${codes.join("")}${text}${ANSI.reset}`;
}

function getNetworkUrls(port: string | number): string[] {
  const addresses = new Set<string>();
  const interfaces = networkInterfaces();

  for (const details of Object.values(interfaces)) {
    if (!details) continue;

    for (const address of details) {
      if (address.internal || address.family !== "IPv4") continue;
      addresses.add(`http://${address.address}:${port}/`);
    }
  }

  return Array.from(addresses).sort((left, right) => left.localeCompare(right));
}

export async function trackInFlightRequests(ctx: Context, next: Next) {
  if (shuttingDown) {
    const message = "Server is shutting down, please retry in a moment.";
    return ctx.json({ message: { message } }, 503);
  }

  activeRequests++;
  try {
    await next();
  } finally {
    activeRequests = Math.max(0, activeRequests - 1);
  }
}

export function printStartupBanner(port: string | number): void {
  const readyInMs = Date.now() - serverStartedAt;
  const pointer = colorize("->", ANSI.green);
  const localUrl = colorize(`http://localhost:${port}/`, ANSI.cyan);

  const networkUrls = getNetworkUrls(port);

  console.log("");
  console.log(
    [
      colorize("AI-CHAT-SERVER", ANSI.green, ANSI.bold),
      colorize(`[${commitSha}]`, ANSI.cyan),
      colorize("ready in", ANSI.dim),
      colorize(`${readyInMs} ms`, ANSI.bold),
      colorize(`(${env.NODE_ENV})`, ANSI.dim),
    ].join(" "),
  );

  console.log("");
  console.log(`${pointer} ${colorize("Local:", ANSI.bold)}   ${localUrl}`);

  if (networkUrls.length === 0) {
    console.log(`${pointer} ${colorize("Network:", ANSI.bold)} ${colorize("none detected", ANSI.dim)}`);
    return;
  }

  for (const networkUrl of networkUrls) {
    console.log(`${pointer} ${colorize("Network:", ANSI.bold)} ${colorize(networkUrl, ANSI.cyan)}`);
  }
}

export function registerShutdownHandler(server: Bun.Server<undefined>) {
  function shutdown(signal: "SIGINT" | "SIGTERM") {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info(`[Server] ${signal} received. Draining in-flight requests...`, { inFlight: activeRequests });

    const start = Date.now();
    const deadlineMs = 30_000;

    const interval = setInterval(() => {
      const inFlight = activeRequests;
      if (inFlight !== 0 && Date.now() - start <= deadlineMs) return;

      clearInterval(interval);
      logger.info("[Server] Exiting process", { inFlight, waitedMs: Date.now() - start });
      void server.stop().finally(() => process.exit(0));
    }, 250);
  }

  process.on("SIGINT", () => {
    shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    shutdown("SIGTERM");
  });
}
