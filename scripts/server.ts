import { createServerApp } from "./server/app";
import { getCommitSha } from "./server/commit-sha";

const commitSha = getCommitSha();

const { app } = createServerApp({ commitSha });

const PORT = process.env.PORT || 3001;
console.log("[Server] Server started!", { commitSha, env: process.env.NODE_ENV, port: PORT });

export default {
  port: PORT,
  fetch: app.fetch,
  idleTimeout: 0,
  development: process.env.NODE_ENV === "development",
};
