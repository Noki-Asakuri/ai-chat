import { getAll } from "convex-helpers/server/relationships";
import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import { authenticatedMutation, authenticatedQuery, r2 } from "../components";
import { validExtensions } from "./files";

type AttachmentSortField = "createdAt" | "name" | "size";
type AttachmentSortDirection = "asc" | "desc";

function normalizeSearch(search: string | undefined): string {
  return (search ?? "").trim().toLowerCase();
}

function compareAttachments(
  left: { _creationTime: number; name: string; size: number },
  right: { _creationTime: number; name: string; size: number },
  sortField: AttachmentSortField,
  sortDirection: AttachmentSortDirection,
): number {
  let base = 0;

  if (sortField === "createdAt") {
    if (left._creationTime < right._creationTime) base = -1;
    else if (left._creationTime > right._creationTime) base = 1;
  }

  if (sortField === "name") {
    base = left.name.localeCompare(right.name);
  }

  if (sortField === "size") {
    if (left.size < right.size) base = -1;
    else if (left.size > right.size) base = 1;
  }

  if (sortDirection === "desc") return base * -1;
  return base;
}

export const createAttachment = authenticatedMutation({
  args: {
    id: v.string(),
    name: v.string(),
    size: v.number(),
    threadId: v.id("threads"),
    type: v.union(v.literal("image"), v.literal("pdf")),
    source: v.union(v.literal("assistant"), v.literal("user")),
    mimeType: v.string(),
  },
  handler: async (ctx, args) => {
    const user = ctx.user;

    const ext = args.mimeType.split("/")[1];
    const path = `${user.userId}/${args.threadId}/${args.id}.${ext}`;

    if (validExtensions.includes(args.mimeType)) {
      const docId = await ctx.db.insert("attachments", { ...args, userId: user.userId, path });
      return { uniqueId: args.id, docId, path };
    }

    throw new Error("Invalid file type");
  },
});

export const getAllAttachments = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    const user = ctx.user;

    const attachments = await ctx.db
      .query("attachments")
      .withIndex("by_userId", (q) => q.eq("userId", user.userId))
      .order("desc")
      .collect();

    return await Promise.all(
      attachments.map(async (attachment) => {
        const thread = await ctx.db.get("threads", attachment.threadId);
        return { ...attachment, thread };
      }),
    );
  },
});

export const listAttachmentsPage = authenticatedQuery({
  args: {
    page: v.number(),
    pageSize: v.number(),
    search: v.optional(v.string()),
    source: v.union(v.literal("all"), v.literal("assistant"), v.literal("user")),
    type: v.union(v.literal("all"), v.literal("image"), v.literal("pdf")),
    sortField: v.union(v.literal("createdAt"), v.literal("name"), v.literal("size")),
    sortDirection: v.union(v.literal("asc"), v.literal("desc")),
  },
  returns: v.object({
    items: v.array(
      v.object({
        _id: v.id("attachments"),
        _creationTime: v.number(),
        id: v.string(),
        name: v.string(),
        size: v.number(),
        type: v.union(v.literal("image"), v.literal("pdf")),
        source: v.union(v.literal("assistant"), v.literal("user")),
        mimeType: v.string(),
        path: v.string(),
        threadId: v.id("threads"),
        userId: v.string(),
        thread: v.union(
          v.object({
            _id: v.id("threads"),
            title: v.string(),
          }),
          v.null(),
        ),
      }),
    ),
    page: v.number(),
    pageSize: v.number(),
    totalCount: v.number(),
    totalPages: v.number(),
    hasPrev: v.boolean(),
    hasNext: v.boolean(),
    overallCount: v.number(),
    overallBytes: v.number(),
    filteredBytes: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = ctx.user;

    const safePageSize = Math.max(1, Math.min(60, Math.floor(args.pageSize)));
    const requestedPage = Math.max(1, Math.floor(args.page));
    const search = normalizeSearch(args.search);

    const attachments = await ctx.db
      .query("attachments")
      .withIndex("by_userId", (q) => q.eq("userId", user.userId))
      .order("desc")
      .collect();

    let overallBytes = 0;
    for (const attachment of attachments) {
      overallBytes += attachment.size;
    }

    const filtered = attachments.filter((attachment) => {
      if (args.source !== "all" && attachment.source !== args.source) return false;
      if (args.type !== "all" && attachment.type !== args.type) return false;
      if (search.length > 0 && !attachment.name.toLowerCase().includes(search)) return false;
      return true;
    });

    filtered.sort(function (left, right) {
      return compareAttachments(left, right, args.sortField, args.sortDirection);
    });

    let filteredBytes = 0;
    for (const attachment of filtered) {
      filteredBytes += attachment.size;
    }

    const totalCount = filtered.length;
    const totalPages = totalCount === 0 ? 1 : Math.ceil(totalCount / safePageSize);
    const page = requestedPage > totalPages ? totalPages : requestedPage;
    const start = (page - 1) * safePageSize;
    const end = start + safePageSize;
    const pageItems = filtered.slice(start, end);

    const threadIds: Array<Id<"threads">> = [];
    for (const attachment of pageItems) {
      threadIds.push(attachment.threadId);
    }

    const threads = await getAll(ctx.db, threadIds);
    const threadMap = new Map<Id<"threads">, { _id: Id<"threads">; title: string }>();

    for (const thread of threads) {
      if (!thread) continue;
      threadMap.set(thread._id, { _id: thread._id, title: thread.title });
    }

    const items = pageItems.map((attachment) => ({
      ...attachment,
      thread: threadMap.get(attachment.threadId) ?? null,
    }));

    return {
      items,
      page,
      pageSize: safePageSize,
      totalCount,
      totalPages,
      hasPrev: page > 1,
      hasNext: page < totalPages,
      overallCount: attachments.length,
      overallBytes,
      filteredBytes,
    };
  },
});

export const deleteAttachment = authenticatedMutation({
  args: { attachmentId: v.id("attachments") },
  handler: async (ctx, args) => {
    const user = ctx.user;

    const attachment = await ctx.db.get("attachments", args.attachmentId);
    if (!attachment) throw new Error("Attachment not found");
    if (attachment.userId !== user.userId) throw new Error("Not authorized");

    // Unlink this attachment from any messages in the same thread for this user
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_userId_threadId", (q) =>
        q.eq("userId", user.userId).eq("threadId", attachment.threadId),
      )
      .collect();

    for (const message of messages) {
      const current = message.attachments ?? [];
      if (current.length === 0) continue;

      const filtered = current.filter((id) => id !== args.attachmentId);
      if (filtered.length !== current.length) {
        await ctx.db.patch(message._id, { attachments: filtered });
      }
    }

    await r2.deleteObject(ctx, attachment.path);
    await ctx.db.delete(args.attachmentId);
  },
});

/**
 * Bulk delete multiple attachments in one request.
 * - Verifies ownership for all provided ids.
 * - Unlinks all provided attachments from any of the user's messages in the corresponding threads.
 * - Deletes files from R2 and removes attachment documents.
 */
export const deleteAttachments = authenticatedMutation({
  args: { attachmentIds: v.array(v.id("attachments")) },
  handler: async (ctx, args) => {
    const user = ctx.user;
    if (args.attachmentIds.length === 0) return;

    // Load and validate all attachments
    const attachments = await getAll(ctx.db, args.attachmentIds);
    const notFound = attachments.findIndex((a) => a === null);

    if (notFound !== -1) throw new Error("Attachment not found");
    const owned = attachments as NonNullable<(typeof attachments)[number]>[];

    for (const a of owned) {
      if (a.userId !== user.userId) throw new Error("Not authorized");
    }

    // Group by threadId to minimize message scans
    const byThread = new Map<Id<"threads">, Set<Id<"attachments">>>();
    for (const a of owned) {
      const key = a.threadId;
      const set = byThread.get(key) ?? new Set<Id<"attachments">>();

      set.add(a._id);
      byThread.set(key, set);
    }

    // For each affected thread, unlink all targeted attachments from the user's messages
    for (const [threadId, ids] of byThread) {
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_userId_threadId", (q) =>
          q.eq("userId", user.userId).eq("threadId", threadId),
        )
        .collect();

      for (const message of messages) {
        const current = message.attachments ?? [];
        if (current.length === 0) continue;
        const filtered = current.filter((id) => !ids.has(id));

        if (filtered.length !== current.length) {
          await ctx.db.patch(message._id, { attachments: filtered });
        }
      }
    }

    // Delete files from R2 and remove attachment documents
    await Promise.all(
      owned.map(async (a) => {
        await r2.deleteObject(ctx, a.path);
        await ctx.db.delete(a._id);
      }),
    );
  },
});
