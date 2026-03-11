import { networkInterfaces } from "node:os";

import { createServerApp } from "./server/app";
import { getCommitSha } from "./server/commit-sha";

import { env } from "./server/env";

const ANSI = {
  reset: "\u001b[0m",
  bold: "\u001b[1m",
  dim: "\u001b[2m",
  green: "\u001b[32m",
  cyan: "\u001b[36m",
} as const;

const startupStartedAt = Date.now();
const commitSha = getCommitSha();

const { app } = createServerApp({ commitSha });

const PORT = process.env.PORT || 3001;
printStartupBanner({ commitSha, envName: env.NODE_ENV, port: PORT, startupStartedAt });

function canUseColor(): boolean {
  return Boolean(process.stdout.isTTY && process.env.NO_COLOR === undefined);
}

function colorize(text: string, ...codes: string[]): string {
  if (!canUseColor() || codes.length === 0) return text;
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

function printStartupBanner(options: {
  commitSha: string;
  envName: string;
  port: string | number;
  startupStartedAt: number;
}): void {
  const readyInMs = Date.now() - options.startupStartedAt;
  const pointer = colorize("->", ANSI.green);
  const localUrl = colorize(`http://localhost:${options.port}/`, ANSI.cyan);
  const networkUrls = getNetworkUrls(options.port);

  console.log("");
  console.log(
    [
      colorize("AI-CHAT-SERVER", ANSI.green, ANSI.bold),
      colorize(`v${options.commitSha}`, ANSI.green),
      colorize("ready in", ANSI.dim),
      colorize(`${readyInMs} ms`, ANSI.bold),
      colorize(`(${options.envName})`, ANSI.dim),
    ].join(" "),
  );
  console.log("");

  console.log(`${pointer} ${colorize("Local:", ANSI.bold)}   ${localUrl}`);

  if (networkUrls.length === 0) {
    console.log(
      `${pointer} ${colorize("Network:", ANSI.bold)} ${colorize("none detected", ANSI.dim)}`,
    );
    return;
  }

  for (const networkUrl of networkUrls) {
    console.log(`${pointer} ${colorize("Network:", ANSI.bold)} ${colorize(networkUrl, ANSI.cyan)}`);
  }
}

export default {
  port: PORT,
  fetch: app.fetch,
  idleTimeout: 0,
  development: process.env.NODE_ENV === "development",
};
