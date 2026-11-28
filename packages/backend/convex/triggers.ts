import { customCtx, customMutation } from "convex-helpers/server/customFunctions";
import { Triggers } from "convex-helpers/server/triggers";

import type { DataModel, Id } from "./_generated/dataModel";
import { internalMutation as rawInternalMutation, type MutationCtx } from "./_generated/server";

export const triggers = new Triggers<DataModel>();

async function adjustThreadMessageCount(ctx: MutationCtx, threadId: Id<"threads">, delta: number) {
  const thread = await ctx.db.get("threads", threadId);
  // Threads without a stored count are filled in by the `backfillThreadMessageCounts` migration,
  // which counts from scratch, so adjusting them here would double count.
  if (!thread || thread.messageCount === undefined) return;

  await ctx.db.patch("threads", threadId, { messageCount: Math.max(0, thread.messageCount + delta) });
}

// Keeps `threads.messageCount` in step with every message written through a wrapped mutation,
// so the thread library can sort and filter by it without reading each thread's messages.
triggers.register("messages", async (ctx, change) => {
  if (change.operation === "insert") {
    await adjustThreadMessageCount(ctx, change.newDoc.threadId, 1);
    return;
  }

  if (change.operation === "delete") {
    await adjustThreadMessageCount(ctx, change.oldDoc.threadId, -1);
  }
});

// `rawDb` skips triggers. Use it only where a trigger's work is pointless, like deleting the messages of a
// thread that is already gone: the wrapped writer reads every document it deletes, which costs a read each.
export function withTriggers(ctx: MutationCtx) {
  return { ...triggers.wrapDB(ctx), rawDb: ctx.db };
}

/** Internal mutations that write messages must use this, so triggers run. `authenticatedMutation` wraps itself. */
export const internalMutation = customMutation(rawInternalMutation, customCtx(withTriggers));
