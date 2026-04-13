/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as components_ from "../components.js";
import type * as crons from "../crons.js";
import type * as functions_attachments from "../functions/attachments.js";
import type * as functions_auth from "../functions/auth.js";
import type * as functions_files from "../functions/files.js";
import type * as functions_groups from "../functions/groups.js";
import type * as functions_messages from "../functions/messages.js";
import type * as functions_profiles from "../functions/profiles.js";
import type * as functions_statistics from "../functions/statistics.js";
import type * as functions_threadShares from "../functions/threadShares.js";
import type * as functions_threads from "../functions/threads.js";
import type * as functions_usages from "../functions/usages.js";
import type * as functions_user_stats from "../functions/user_stats.js";
import type * as functions_users from "../functions/users.js";
import type * as http from "../http.js";
import type * as migrations from "../migrations.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  components: typeof components_;
  crons: typeof crons;
  "functions/attachments": typeof functions_attachments;
  "functions/auth": typeof functions_auth;
  "functions/files": typeof functions_files;
  "functions/groups": typeof functions_groups;
  "functions/messages": typeof functions_messages;
  "functions/profiles": typeof functions_profiles;
  "functions/statistics": typeof functions_statistics;
  "functions/threadShares": typeof functions_threadShares;
  "functions/threads": typeof functions_threads;
  "functions/usages": typeof functions_usages;
  "functions/user_stats": typeof functions_user_stats;
  "functions/users": typeof functions_users;
  http: typeof http;
  migrations: typeof migrations;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  r2: import("@convex-dev/r2/_generated/component.js").ComponentApi<"r2">;
  crons: import("@convex-dev/crons/_generated/component.js").ComponentApi<"crons">;
  migrations: import("@convex-dev/migrations/_generated/component.js").ComponentApi<"migrations">;
  workOSAuthKit: import("@convex-dev/workos-authkit/_generated/component.js").ComponentApi<"workOSAuthKit">;
  actionRetrier: import("@convex-dev/action-retrier/_generated/component.js").ComponentApi<"actionRetrier">;
};
