import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { createServerFn } from "@tanstack/react-start";
import { getAuth } from "@workos/authkit-tanstack-react-start";
import { convertToModelMessages } from "ai";

import { createServerConvexClient } from "@/lib/convex/server";
import { updateTitle } from "@/lib/server/update-title";
import type { UIChatMessage } from "@/lib/types";
import { tryCatch } from "@/lib/utils";

export const regenerateThreadTitleServerFn = createServerFn({ method: "GET" })
  .inputValidator((data: { threadId: Id<"threads"> }) => data)
  .handler(async ({ data }) => {
    try {
      const { user } = await getAuth();
      if (!user) return { error: "Not authenticated" };

      const serverConvexClient = createServerConvexClient();

      const { title } = await serverConvexClient.query(api.functions.threads.getThreadTitle, {
        threadId: data.threadId,
      });

      // Either user is not logged in or thread doesn't belong to user.
      if (title === null) return { error: "Thread not found" };

      // Optimistically mark the title as regenerating on the server.
      await serverConvexClient.mutation(api.functions.threads.updateThreadTitle, {
        threadId: data.threadId,
        title: "Regenerating...",
      });

      const [result, error] = await tryCatch(
        serverConvexClient.query(api.functions.messages.getAllMessagesWithoutAttachments, {
          threadId: data.threadId,
        }),
      );

      if (error) return { error: error.message };
      if (result.length === 0) return { error: "No messages found" };

      const firstUser = result.find((m) => m.role === "user");
      if (!firstUser || !firstUser.parts.length) return { error: "No user message found" };

      const messages = await convertToModelMessages([
        { role: "user", parts: firstUser.parts as UIChatMessage["parts"] },
      ]);

      await updateTitle({ threadId: data.threadId, messages, serverConvexClient });

      return { status: "ok" };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      return { error: error.message };
    }
  });
