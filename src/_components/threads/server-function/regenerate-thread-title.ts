import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { createServerFn } from "@tanstack/react-start";

import { withAuth } from "@/lib/authkit/ssr/session";
import { createServerConvexClient } from "@/lib/convex/server";
import { updateTitle } from "@/lib/server/update-title";

export const regenerateThreadTitleServerFn = createServerFn({ method: "GET" })
  .inputValidator((data: { threadId: Id<"threads"> }) => data)
  .handler(async ({ data }) => {
    try {
      const { user, sessionId } = await withAuth();
      if (!user) return { error: "Not authenticated" };

      const serverConvexClient = createServerConvexClient();

      // Optimistically mark the title as regenerating on the server.
      await serverConvexClient.mutation(api.functions.threads.updateThreadTitle, {
        sessionId,
        threadId: data.threadId,
        title: "Regenerating...",
      });

      const { messages } = await serverConvexClient.query(
        api.functions.messages.getAllMessagesFromThread,
        { threadId: data.threadId, sessionId },
      );

      if (messages.length === 0) return { error: "No messages found" };

      const firstUser = messages.find((m) => m.role === "user");
      if (!firstUser || !firstUser.content) return { error: "No user message found" };

      const input: Array<{ role: string; content: string }> = [
        { role: "user", content: firstUser.content },
      ];

      await updateTitle({
        threadId: data.threadId,
        messages: input,
        serverConvexClient,
        sessionId,
      });

      return { status: "ok" };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      return { error: error.message };
    }
  });
