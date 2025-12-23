import { execSync } from "node:child_process";

export function getCommitSha(): string {
  const envSha = process.env.GIT_COMMIT_SHA || process.env.COMMIT_SHA;
  if (envSha && envSha.length > 0) return envSha;

  try {
    const out = execSync("git rev-parse --short=12 HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    });
    const sha = out.toString("utf8").trim();
    if (sha) return sha;
  } catch {
    // ignore and fall through
  }

  return "unknown";
}