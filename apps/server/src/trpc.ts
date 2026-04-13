import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";
import { chatModelParamsSchema } from "@ai-chat/shared/chat/request";
import {
  regenerateThreadTitleInputSchema,
  syncThreadModelConfigInputSchema,
} from "@ai-chat/shared/chat/trpc";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { type FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";

import { type ServerAuthContext, getAuthContextFromRequest } from "./auth";
import { createServerConvexClient } from "./lib/convex-client";
import { updateThreadTitleFromContent } from "./lib/update-title";

type TRPCContext = {
  auth: ServerAuthContext;
  resHeaders: Headers;
};

async function createTRPCContext(options: FetchCreateContextFnOptions): Promise<TRPCContext> {
  try {
    const auth = await getAuthContextFromRequest(options.req);

    return { auth, resHeaders: options.resHeaders };
  } catch {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
}

const t = initTRPC.context<TRPCContext>().create();

const protectedProcedure = t.procedure.use(async function enforceAuth(options) {
  if (!options.ctx.auth.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const result = await options.next({
    ctx: options.ctx,
  });

  const pendingSetCookieHeader = options.ctx.auth.flushPendingSetCookieHeader();
  if (pendingSetCookieHeader) {
    options.ctx.resHeaders.append("Set-Cookie", pendingSetCookieHeader);
  }

  return result;
});

const threadIdSchema = z.custom<Id<"threads">>((data) => z.string().parse(data));
const profileIdSchema = z.custom<Id<"profiles">>((data) => z.string().parse(data));

const syncModelConfigInputSchema = syncThreadModelConfigInputSchema.extend({
  threadId: threadIdSchema.optional(),
  modelParams: chatModelParamsSchema.extend({
    profile: profileIdSchema.nullable().optional(),
  }),
});

const regenerateTitleInputSchema = regenerateThreadTitleInputSchema.extend({
  threadId: threadIdSchema,
});

export const appRouter = t.router({
  thread: t.router({
    syncModelConfig: protectedProcedure
      .input(syncModelConfigInputSchema)
      .mutation(async function syncModelConfig(options) {
        const convexClient = createServerConvexClient({
          getAccessToken: options.ctx.auth.getAccessToken,
        });

        if (options.input.threadId) {
          await convexClient.mutation(api.functions.threads.updateThreadModelConfig, {
            threadId: options.input.threadId,
            latestModel: options.input.model,
            latestModelParams: options.input.modelParams,
          });
          return { ok: true };
        }

        await convexClient.mutation(api.functions.users.updateUserDefaultModelConfig, {
          defaultModel: options.input.model,
          modelParams: options.input.modelParams,
        });

        return { ok: true };
      }),
    regenerateTitle: protectedProcedure
      .input(regenerateTitleInputSchema)
      .mutation(async function regenerateTitle(options) {
        const convexClient = createServerConvexClient({
          getAccessToken: options.ctx.auth.getAccessToken,
        });

        const { title } = await convexClient.query(api.functions.threads.getThreadTitle, {
          threadId: options.input.threadId,
        });

        if (title === null) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Thread not found" });
        }

        await convexClient.mutation(api.functions.threads.updateThreadTitle, {
          threadId: options.input.threadId,
          title: "Regenerating...",
        });

        const result = await convexClient.query(api.functions.messages.getAllMessagesWithoutAttachments, {
          threadId: options.input.threadId,
        });

        if (result.length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No messages found" });
        }

        const firstUser = result.find((message) => message.role === "user");
        if (!firstUser || firstUser.parts.length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No user message found" });
        }

        let content = "Empty message";
        for (const part of firstUser.parts) {
          if (typeof part !== "object" || part === null) continue;
          if (!("type" in part) || !("text" in part)) continue;
          if (part.type !== "text" || typeof part.text !== "string") continue;

          content = part.text;
          break;
        }

        await updateThreadTitleFromContent({
          content,
          threadId: options.input.threadId,
          serverConvexClient: convexClient,
        });

        return { ok: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;

export function handleTRPCRequest(request: Request): Promise<Response> {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: request,
    router: appRouter,
    createContext: createTRPCContext,
  });
}
