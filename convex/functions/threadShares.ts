import { getAll } from "convex-helpers/server/relationships";
import { v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import { query, type MutationCtx } from "../_generated/server";
import { authenticatedMutation, authenticatedQuery } from "../components";
import { threadShareMode, threadShareVisibility } from "../schema";

type MessageDoc = Doc<"messages">;
type UserMessageDoc = MessageDoc & { role: "user" };
type AssistantMessageDoc = MessageDoc & { role: "assistant" };

type ThreadMessageGraph = {
  messagesById: Record<Id<"messages">, MessageDoc>;

  users: UserMessageDoc[];
  userById: Record<Id<"messages">, UserMessageDoc>;

  assistantsByUserId: Record<Id<"messages">, AssistantMessageDoc[]>;
  parentUserIdByAssistantId: Record<Id<"messages">, Id<"messages">>;
  activeAssistantByUserId: Record<Id<"messages">, AssistantMessageDoc>;

  canonicalMessageIds: Array<Id<"messages">>;
};

function isUserMessage(message: MessageDoc): message is UserMessageDoc {
  return message.role === "user";
}

function isAssistantMessage(message: MessageDoc): message is AssistantMessageDoc {
  return message.role === "assistant";
}

function sortMessagesAscending(messages: MessageDoc[]): MessageDoc[] {
  const sorted = [...messages];

  sorted.sort((a, b) => {
    const createdAtDelta = a.createdAt - b.createdAt;
    if (createdAtDelta !== 0) return createdAtDelta;

    const creationTimeDelta = a._creationTime - b._creationTime;
    if (creationTimeDelta !== 0) return creationTimeDelta;

    return a.updatedAt - b.updatedAt;
  });

  return sorted;
}

function sortAssistantVariants(variants: AssistantMessageDoc[]): AssistantMessageDoc[] {
  const sorted = [...variants];

  sorted.sort((a, b) => {
    const aVariantIndex = a.variantIndex;
    const bVariantIndex = b.variantIndex;

    if (aVariantIndex !== undefined && bVariantIndex !== undefined) {
      const variantDelta = aVariantIndex - bVariantIndex;
      if (variantDelta !== 0) return variantDelta;
    }

    const createdAtDelta = a.createdAt - b.createdAt;
    if (createdAtDelta !== 0) return createdAtDelta;

    return a._creationTime - b._creationTime;
  });

  return sorted;
}

function findFallbackParentUserId(
  users: UserMessageDoc[],
  assistant: AssistantMessageDoc,
): Id<"messages"> | null {
  let fallbackUserId: Id<"messages"> | null = null;

  for (const userMessage of users) {
    if (userMessage._creationTime > assistant._creationTime) break;
    fallbackUserId = userMessage._id;
  }

  return fallbackUserId;
}

function buildThreadMessageGraph(messages: MessageDoc[]): ThreadMessageGraph {
  const sortedMessages = sortMessagesAscending(messages);

  const messagesById: Record<Id<"messages">, MessageDoc> = {};
  const users: UserMessageDoc[] = [];
  const assistants: AssistantMessageDoc[] = [];

  for (const message of sortedMessages) {
    messagesById[message._id] = message;

    if (isUserMessage(message)) {
      users.push(message);
      continue;
    }

    if (isAssistantMessage(message)) {
      assistants.push(message);
    }
  }

  const userById: Record<Id<"messages">, UserMessageDoc> = {};
  for (const userMessage of users) {
    userById[userMessage._id] = userMessage;
  }

  const assistantsByUserId: Record<Id<"messages">, AssistantMessageDoc[]> = {};
  const parentUserIdByAssistantId: Record<Id<"messages">, Id<"messages">> = {};

  for (const assistantMessage of assistants) {
    let parentUserMessageId: Id<"messages"> | null = null;

    if (assistantMessage.parentUserMessageId) {
      const parentUser = userById[assistantMessage.parentUserMessageId];
      if (parentUser) {
        parentUserMessageId = parentUser._id;
      }
    }

    if (parentUserMessageId === null) {
      parentUserMessageId = findFallbackParentUserId(users, assistantMessage);
    }

    if (parentUserMessageId === null) continue;

    if (!assistantsByUserId[parentUserMessageId]) {
      assistantsByUserId[parentUserMessageId] = [];
    }

    assistantsByUserId[parentUserMessageId]!.push(assistantMessage);
    parentUserIdByAssistantId[assistantMessage._id] = parentUserMessageId;
  }

  const groupedUserMessageIds = Object.keys(assistantsByUserId) as Array<Id<"messages">>;
  for (const userMessageId of groupedUserMessageIds) {
    const variants = assistantsByUserId[userMessageId];
    if (!variants || variants.length === 0) continue;
    assistantsByUserId[userMessageId] = sortAssistantVariants(variants);
  }

  const activeAssistantByUserId: Record<Id<"messages">, AssistantMessageDoc> = {};
  const canonicalMessageIds: Array<Id<"messages">> = [];

  for (const userMessage of users) {
    canonicalMessageIds.push(userMessage._id);

    const variants = assistantsByUserId[userMessage._id] ?? [];
    if (variants.length === 0) continue;

    let activeAssistant: AssistantMessageDoc | null = null;

    if (userMessage.activeAssistantMessageId) {
      for (const variant of variants) {
        if (variant._id === userMessage.activeAssistantMessageId) {
          activeAssistant = variant;
          break;
        }
      }
    }

    if (activeAssistant === null) {
      activeAssistant = variants[variants.length - 1] ?? null;
    }

    if (activeAssistant === null) continue;

    activeAssistantByUserId[userMessage._id] = activeAssistant;
    canonicalMessageIds.push(activeAssistant._id);
  }

  return {
    messagesById,
    users,
    userById,
    assistantsByUserId,
    parentUserIdByAssistantId,
    activeAssistantByUserId,
    canonicalMessageIds,
  };
}

function normalizeAllowedEmails(emails: string[]): string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const email of emails) {
    const trimmed = email.trim().toLowerCase();
    if (trimmed.length === 0) continue;
    if (seen.has(trimmed)) continue;

    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized;
}

function parseAllowedEmailsText(text: string): string[] {
  const separators = /[\n,;\t ]+/;
  const parts = text
    .split(separators)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return normalizeAllowedEmails(parts);
}

function randomToken(length: number): string {
  const alphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = "";

  for (const byte of bytes) {
    out += alphabet[byte % alphabet.length]!;
  }

  return out;
}

async function generateUniqueShareId(ctx: MutationCtx) {
  for (let attempts = 0; attempts < 6; attempts += 1) {
    const shareId = randomToken(24);

    const existing = await ctx.db
      .query("threadShares")
      .withIndex("by_shareId", (q) => q.eq("shareId", shareId))
      .unique();

    if (!existing) return shareId;
  }

  throw new Error("Failed to generate share link");
}

type SharedMessageWithAttachments = Omit<Doc<"messages">, "attachments"> & {
  attachments: Doc<"attachments">[];
};

type ThreadShareSettings = {
  shareId: string | null;
  urlPath: string | null;
  threadId: Id<"threads">;
  visibility: "public" | "private";
  mode: "snapshot" | "live";
  allowedEmails: string[];
  allowedEmailsText: string;
  snapshotAt: number | null;
  createdAt: number | null;
  updatedAt: number | null;
};

function serializeShareSettings(
  share: Doc<"threadShares"> | null,
  threadId: Id<"threads">,
): ThreadShareSettings {
  if (!share) {
    return {
      shareId: null,
      urlPath: null,
      threadId,
      visibility: "public",
      mode: "live",
      allowedEmails: [],
      allowedEmailsText: "",
      snapshotAt: null,
      createdAt: null,
      updatedAt: null,
    };
  }

  return {
    shareId: share.shareId,
    urlPath: `/share/${share.shareId}`,
    threadId,
    visibility: share.visibility,
    mode: share.mode,
    allowedEmails: share.allowedEmails,
    allowedEmailsText: share.allowedEmails.join("\n"),
    snapshotAt: share.snapshotAt ?? null,
    createdAt: share.createdAt,
    updatedAt: share.updatedAt,
  };
}

export const getThreadShareSettings = authenticatedQuery({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args) => {
    const user = ctx.user;
    if (!user) throw new Error("Not authenticated");

    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new Error("Thread not found");
    if (thread.userId !== user.userId) throw new Error("Not authorized");

    const share = await ctx.db
      .query("threadShares")
      .withIndex("by_threadId", (q) => q.eq("threadId", args.threadId))
      .unique();

    return serializeShareSettings(share, args.threadId);
  },
});

export const upsertThreadShare = authenticatedMutation({
  args: {
    threadId: v.id("threads"),
    visibility: threadShareVisibility,
    mode: threadShareMode,
    allowedEmailsText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = ctx.user;
    if (!user) throw new Error("Not authenticated");

    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new Error("Thread not found");
    if (thread.userId !== user.userId) throw new Error("Not authorized");

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_userId_threadId", (q) =>
        q.eq("userId", user.userId).eq("threadId", args.threadId),
      )
      .order("asc")
      .collect();

    const graph = buildThreadMessageGraph(messages);
    const canonicalMessageIds = graph.canonicalMessageIds;
    const latestCanonicalMessageId = canonicalMessageIds[canonicalMessageIds.length - 1] ?? null;
    const latestCanonicalMessage = latestCanonicalMessageId
      ? graph.messagesById[latestCanonicalMessageId]
      : null;

    const normalizedAllowedEmails = normalizeAllowedEmails([
      ...parseAllowedEmailsText(args.allowedEmailsText ?? ""),
      user.emailAddress ?? "",
    ]);

    const existing = await ctx.db
      .query("threadShares")
      .withIndex("by_threadId", (q) => q.eq("threadId", args.threadId))
      .unique();

    const now = Date.now();
    const latestCanonicalCreatedAt = latestCanonicalMessage?.createdAt ?? now;
    const nextSnapshotAt =
      args.mode === "snapshot"
        ? existing?.mode === "snapshot"
          ? (existing.snapshotAt ?? latestCanonicalCreatedAt)
          : latestCanonicalCreatedAt
        : undefined;

    if (!existing) {
      const shareId = await generateUniqueShareId(ctx);

      await ctx.db.insert("threadShares", {
        threadId: args.threadId,
        ownerUserId: user.userId,
        shareId,

        visibility: args.visibility,
        mode: args.mode,
        allowedEmails: normalizedAllowedEmails,
        snapshotAt: nextSnapshotAt,

        createdAt: now,
        updatedAt: now,
      });

      const created = await ctx.db
        .query("threadShares")
        .withIndex("by_shareId", (q) => q.eq("shareId", shareId))
        .unique();

      return serializeShareSettings(created, args.threadId);
    }

    await ctx.db.patch(existing._id, {
      visibility: args.visibility,
      mode: args.mode,
      allowedEmails: normalizedAllowedEmails,
      snapshotAt: nextSnapshotAt,
      updatedAt: now,
    });

    const updated = await ctx.db
      .query("threadShares")
      .withIndex("by_threadId", (q) => q.eq("threadId", args.threadId))
      .unique();

    return serializeShareSettings(updated, args.threadId);
  },
});

export const disableThreadShare = authenticatedMutation({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args) => {
    const user = ctx.user;
    if (!user) throw new Error("Not authenticated");

    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new Error("Thread not found");
    if (thread.userId !== user.userId) throw new Error("Not authorized");

    const existing = await ctx.db
      .query("threadShares")
      .withIndex("by_threadId", (q) => q.eq("threadId", args.threadId))
      .unique();

    if (!existing) {
      return serializeShareSettings(null, args.threadId);
    }

    await ctx.db.delete(existing._id);

    return serializeShareSettings(null, args.threadId);
  },
});

export const getSharedThread = query({
  args: { shareId: v.string(), sessionId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const sessionId = args.sessionId;

    const share = await ctx.db
      .query("threadShares")
      .withIndex("by_shareId", (q) => q.eq("shareId", args.shareId))
      .unique();

    if (!share) throw new Error("Shared thread not found");

    const thread = await ctx.db.get(share.threadId);
    if (!thread) throw new Error("Shared thread not found");

    const ownerUser = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", thread.userId))
      .unique();

    let viewerUser: Doc<"users"> | null = null;

    if (sessionId) {
      const session = await ctx.db
        .query("session")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
        .unique();

      if (session) {
        viewerUser = await ctx.db
          .query("users")
          .withIndex("by_userId", (q) => q.eq("userId", session.userId))
          .unique();
      }
    }

    if (share.visibility === "private") {
      const viewerEmail = viewerUser?.emailAddress?.toLowerCase() ?? null;
      const isOwner = viewerUser?.userId === share.ownerUserId;
      const isAllowedByEmail = viewerEmail ? share.allowedEmails.includes(viewerEmail) : false;

      if (!isOwner && !isAllowedByEmail) {
        throw new Error("Share access denied");
      }
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_threadId", (q) => q.eq("threadId", share.threadId))
      .order("asc")
      .collect();

    const snapshotAt = share.snapshotAt;

    const filteredMessages =
      share.mode === "snapshot" && snapshotAt !== undefined
        ? messages.filter((message) => message.createdAt <= snapshotAt)
        : messages;

    const graph = buildThreadMessageGraph(filteredMessages);

    const canonicalMessageIds = graph.canonicalMessageIds;
    const canonicalSliceIds = canonicalMessageIds;

    const sliceUserMessageIds = new Set<Id<"messages">>();
    for (const messageId of canonicalSliceIds) {
      const message = graph.messagesById[messageId];
      if (!message) continue;

      if (message.role === "user") {
        sliceUserMessageIds.add(message._id);
        continue;
      }

      const parentUserMessageId = message.parentUserMessageId;
      if (parentUserMessageId) {
        sliceUserMessageIds.add(parentUserMessageId);
      }
    }

    const visibleMessageIds = new Set<Id<"messages">>(canonicalSliceIds);
    for (const userMessageId of sliceUserMessageIds) {
      visibleMessageIds.add(userMessageId);

      const variants = graph.assistantsByUserId[userMessageId] ?? [];
      for (const variant of variants) {
        visibleMessageIds.add(variant._id);
      }
    }

    const visibleMessages: MessageDoc[] = [];
    for (const messageId of visibleMessageIds) {
      const message = graph.messagesById[messageId];
      if (!message) continue;
      visibleMessages.push(message);
    }

    const attachmentIdSet = new Set<Id<"attachments">>();
    for (const message of visibleMessages) {
      for (const attachmentId of message.attachments) {
        attachmentIdSet.add(attachmentId);
      }
    }

    const attachmentIds = Array.from(attachmentIdSet);
    const attachmentDocs = attachmentIds.length > 0 ? await getAll(ctx.db, attachmentIds) : [];

    const attachmentsById: Record<Id<"attachments">, Doc<"attachments">> = {};
    for (const attachmentDoc of attachmentDocs) {
      if (!attachmentDoc) continue;
      attachmentsById[attachmentDoc._id] = attachmentDoc;
    }

    const hydratedVisibleMessagesById: Record<Id<"messages">, SharedMessageWithAttachments> = {};
    for (const message of visibleMessages) {
      const hydratedAttachments: Doc<"attachments">[] = [];

      for (const attachmentId of message.attachments) {
        const attachment = attachmentsById[attachmentId];
        if (!attachment) continue;
        hydratedAttachments.push(attachment);
      }

      hydratedVisibleMessagesById[message._id] = {
        ...message,
        attachments: hydratedAttachments,
      };
    }

    const allMessages: SharedMessageWithAttachments[] = [];
    const sortedVisibleMessages = sortMessagesAscending(visibleMessages);
    for (const message of sortedVisibleMessages) {
      const hydrated = hydratedVisibleMessagesById[message._id];
      if (!hydrated) continue;
      allMessages.push(hydrated);
    }

    const canonicalMessages: SharedMessageWithAttachments[] = [];
    for (const messageId of canonicalSliceIds) {
      const message = hydratedVisibleMessagesById[messageId];
      if (!message) continue;
      canonicalMessages.push(message);
    }

    const variantMessageIdsByUserMessageId: Record<Id<"messages">, Array<Id<"messages">>> = {};

    for (const userMessageId of sliceUserMessageIds) {
      const variants = graph.assistantsByUserId[userMessageId] ?? [];
      if (variants.length === 0) continue;

      variantMessageIdsByUserMessageId[userMessageId] = [];

      for (const variant of variants) {
        variantMessageIdsByUserMessageId[userMessageId]!.push(variant._id);
      }
    }

    return {
      share: {
        shareId: share.shareId,
        visibility: share.visibility,
        mode: share.mode,
        snapshotAt: share.snapshotAt ?? null,
        updatedAt: share.updatedAt,
      },
      thread: {
        _id: thread._id,
        title: thread.title,
      },
      user: {
        displayName: getSharedThreadUserDisplayName(ownerUser),
        avatarUrl: ownerUser?.imageUrl ?? null,
      },
      messages: canonicalMessages,
      allMessages,
      variantMessageIdsByUserMessageId,
    };
  },
});

function getSharedThreadUserDisplayName(user: Doc<"users"> | null): string {
  if (!user?.username) return "User";

  const username = user.username.trim();
  return username.length > 0 ? username : "User";
}
