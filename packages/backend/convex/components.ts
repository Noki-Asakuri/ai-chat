import { ActionRetrier } from "@convex-dev/action-retrier";
import { R2 } from "@convex-dev/r2";
import { AuthKit, type AuthFunctions } from "@convex-dev/workos-authkit";

import { customMutation, customQuery } from "convex-helpers/server/customFunctions";

import { components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";

const authFunctions: AuthFunctions = internal.functions.auth;

export const r2 = new R2(components.r2);
export const retrier = new ActionRetrier(components.actionRetrier);
export const authKit = new AuthKit<DataModel>(components.workOSAuthKit, {
  authFunctions,
});

export const authenticatedQuery = customQuery(query, {
  args: {},
  input: async (ctx) => {
    const userFromAuthKit = await ctx.auth.getUserIdentity();
    if (!userFromAuthKit) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", userFromAuthKit.subject))
      .unique();

    if (!user) throw new Error("User not found");

    return { ctx: { ...ctx, user }, args: {} };
  },
});

/**
 * Authenticate a query without loading the application's user document.
 * Use this for reads that only need the stable WorkOS user ID for ownership.
 */
export const authenticatedUserIdQuery = customQuery(query, {
  args: {},
  input: async (ctx) => {
    const userFromAuthKit = await ctx.auth.getUserIdentity();
    if (!userFromAuthKit) throw new Error("Not authenticated");

    return { ctx: { ...ctx, userId: userFromAuthKit.subject }, args: {} };
  },
});

export const authenticatedMutation = customMutation(mutation, {
  args: {},
  input: async (ctx) => {
    const userFromAuthKit = await ctx.auth.getUserIdentity();
    if (!userFromAuthKit) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", userFromAuthKit.subject))
      .unique();

    if (!user) throw new Error("User not found");

    return { ctx: { ...ctx, user }, args: {} };
  },
});
