import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

// Monthly reset of per-user message usage.
//
// Schedule: 1st day of every month at 00:00 UTC
// Convex guideline: Use crons.monthly (or crons.cron with a cron string) and call an internal function.
const crons = cronJobs();

crons.monthly(
  "reset monthly usage",
  { day: 1, hourUTC: 0, minuteUTC: 0 },
  internal.functions.usages.resetAll,
  {},
);

export default crons;
