import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";
import { chatModelParamsSchema } from "@ai-chat/shared/chat/request";

import { TRPCError } from "@trpc/server";
import type { TextPart } from "ai";
import { z } from "zod/v4";

import { generateNewThreadTitleAndSave } from "@/libs/ai/actions/generate-thread-title";
import { createServerConvexClient } from "@/libs/convex";

import { protectedProcedure, router } from "../index";

export const threadRouter = router({
  syncModelConfig: protectedProcedure
    .input(
      z.object({
        threadId: z.string().optional(),
        model: z.string(),
        modelParams: chatModelParamsSchema,
      }),
    )
    .mutation(async function ({ ctx, input }) {
      const convexClient = await createServerConvexClient(ctx.honoCtx);

      const options = {
        threadId: input.threadId as Id<"threads">,
        model: input.model,
        modelParams: input.modelParams as {
          webSearch: boolean;
          effort: "none" | "minimal" | "low" | "medium" | "high" | "xhigh";
          profile: Id<"profiles"> | null;
        },
      };

      if (input.threadId) {
        await convexClient.mutation(api.functions.threads.updateThreadModelConfig, {
          threadId: options.threadId,
          latestModel: options.model,
          latestModelParams: options.modelParams,
        });

        return { ok: true };
      }

      await convexClient.mutation(api.functions.users.updateUserDefaultModelConfig, {
        defaultModel: options.model,
        modelParams: options.modelParams,
      });

      return { ok: true };
    }),

  regenerateTitle: protectedProcedure
    .input(z.object({ threadId: z.string() }))
    .mutation(async function ({ ctx, input }) {
      const convexClient = await createServerConvexClient(ctx.honoCtx);
      const threadId = input.threadId as Id<"threads">;

      const { title } = await convexClient.query(api.functions.threads.getThreadTitle, {
        threadId,
      });

      if (title === null) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Thread not found" });
      }

      await convexClient.mutation(api.functions.threads.updateThreadTitle, {
        threadId: threadId,
        title: "Regenerating...",
      });

      const messages = await convexClient.query(
        api.functions.messages.getAllMessagesWithoutAttachments,
        { threadId },
      );

      if (messages.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No messages found" });
      }

      const firstUser = messages.find((message) => message.role === "user");
      if (!firstUser || firstUser.parts.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No user message found" });
      }

      let content = "Empty Message";
      const textParts = firstUser.parts.filter((part): part is TextPart => part.type === "text");
      if (!textParts.length) content = "Empty Message";

      content = textParts.map((part) => part.text).join("\n\n");

      await generateNewThreadTitleAndSave(convexClient, {
        modelMessages: [{ role: "user", content }],
        threadId,
      });
      return { ok: true };
    }),
});
