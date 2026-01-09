import { ActionRetrier } from "@convex-dev/action-retrier";
import { R2 } from "@convex-dev/r2";
import { AuthKit, type AuthFunctions } from "@convex-dev/workos-authkit";

import { customMutation, customQuery } from "convex-helpers/server/customFunctions";
import { v } from "convex/values";

import { components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";

const authFunctions: AuthFunctions = internal.functions.auth;

export const r2 = new R2(components.r2);
export const retrier = new ActionRetrier(components.actionRetrier);
export const authKit = new AuthKit<DataModel>(components.workOSAuthKit, {
  authFunctions,
  additionalEventTypes: ["session.created", "session.revoked"],
});

export const authenticatedQuery = customQuery(query, {
  args: { sessionId: v.optional(v.string()) },
  input: async (ctx, { sessionId }) => {
    if (!sessionId) return { ctx: { ...ctx, user: null }, args: {} };

    const session = await ctx.db
      .query("session")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
      .unique();

    if (!session) return { ctx: { ...ctx, user: null }, args: {} };

    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", session.userId))
      .unique();

    return { ctx: { ...ctx, user }, args: {} };
  },
});

export const authenticatedMutation = customMutation(mutation, {
  args: { sessionId: v.string() },
  input: async (ctx, { sessionId }) => {
    if (!sessionId) return { ctx: { ...ctx, user: null }, args: {} };

    const session = await ctx.db
      .query("session")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
      .unique();

    if (!session) return { ctx: { ...ctx, user: null }, args: {} };

    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", session.userId))
      .unique();

    return { ctx: { ...ctx, user }, args: {} };
  },
});
