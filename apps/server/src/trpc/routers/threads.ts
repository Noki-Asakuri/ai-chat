import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";
import { chatModelParamsSchema } from "@ai-chat/shared/chat/request";

import { TRPCError } from "@trpc/server";
import type { TextPart } from "ai";
import { z } from "zod/v4";

import { generateNewThreadTitleAndSave } from "../../libs/ai/actions/generate-thread-title";
import { createServerConvexClient } from "../../libs/convex";

import { protectedProcedure, router } from "../index";

const threadIdSchema = z.string().pipe(z.custom<Id<"threads">>());
const profileIdSchema = z.string().pipe(z.custom<Id<"profiles">>());

export const threadRouter = router({
  syncModelConfig: protectedProcedure
    .input(
      z.object({
        threadId: threadIdSchema.optional(),
        model: z.string(),
        modelParams: chatModelParamsSchema.extend({
          profile: profileIdSchema.nullish().default(null),
        }),
      }),
    )
    .mutation(async function ({ ctx, input }) {
      const convexClient = await createServerConvexClient(ctx.honoCtx);

      if (input.threadId) {
        await convexClient.mutation(api.functions.threads.updateThreadModelConfig, {
          threadId: input.threadId,
          latestModel: input.model,
          latestModelParams: input.modelParams,
        });

        return { ok: true };
      }

      await convexClient.mutation(api.functions.users.updateUserDefaultModelConfig, {
        defaultModel: input.model,
        modelParams: input.modelParams,
      });

      return { ok: true };
    }),

  regenerateTitle: protectedProcedure.input(z.object({ threadId: threadIdSchema })).mutation(async function ({
    ctx,
    input,
  }) {
    const convexClient = await createServerConvexClient(ctx.honoCtx);
    const threadId = input.threadId;

    const { title } = await convexClient.query(api.functions.threads.getThreadTitle, { threadId });

    if (title === null) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Thread not found" });
    }

    await convexClient.mutation(api.functions.threads.updateThreadTitle, {
      threadId: threadId,
      title: "Regenerating...",
    });

    const messages = await convexClient.query(api.functions.messages.getAllMessagesWithoutAttachments, {
      threadId,
    });

    if (messages.length === 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "No messages found" });
    }

    const firstUser = messages.find((message) => message.role === "user");
    if (!firstUser || firstUser.parts.length === 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "No user message found" });
    }

    const textParts = firstUser.parts.filter((part): part is TextPart => part.type === "text");
    const content = textParts.length > 0 ? textParts.map((part) => part.text).join("\n\n") : "Empty Message";

    await generateNewThreadTitleAndSave(convexClient, {
      modelMessages: [{ role: "user", content }],
      threadId,
    });

    return { ok: true };
  }),
});
