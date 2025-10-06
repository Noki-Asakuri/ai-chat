import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { auth } from "@clerk/nextjs/server";
import { waitUntil } from "@vercel/functions";
import { NextResponse } from "next/server";

import { logger, withAxiom } from "@/lib/axiom/server";
import { serverConvexClient } from "@/lib/convex/server";
import { updateTitle } from "@/lib/server/update-title";

export const POST = withAxiom(async (req) => {
  try {
    const user = await auth();
    if (!user.userId) {
      logger.error("[Regenerate Title]: Unauthenticated POST request!");
      return NextResponse.json({ error: { message: "Error: Unauthenticated!" } }, { status: 401 });
    }

    const authToken = await user.getToken({ template: "convex" });
    serverConvexClient.setAuth(authToken!);

    const body = (await req.json()) as { threadId?: Id<"threads"> };
    const threadId = body?.threadId;
    if (!threadId) {
      logger.error("[Regenerate Title]: Missing threadId in request body", { userId: user.userId });
      return NextResponse.json({ error: { message: "Missing threadId" } }, { status: 400 });
    }

    // Optimistically mark the title as regenerating on the server.
    await serverConvexClient.mutation(api.functions.threads.updateThreadTitle, {
      threadId,
      title: "Regenerating",
    });

    const { messages } = await serverConvexClient.query(
      api.functions.messages.getAllMessagesFromThread,
      { threadId },
    );

    if (messages.length === 0) {
      logger.error("[Regenerate Title]: No messages found for thread", {
        userId: user.userId,
        threadId,
      });

      return NextResponse.json(
        { error: { message: "No messages found for thread" } },
        { status: 400 },
      );
    }

    const firstUser = messages.find((m) => m.role === "user");
    if (!firstUser || !firstUser.content) {
      logger.error("[Regenerate Title]: No user message found for thread", {
        userId: user.userId,
        threadId,
      });

      return NextResponse.json(
        { error: { message: "No user message found for thread" } },
        { status: 400 },
      );
    }

    const input: Array<{ role: string; content: string }> = [
      { role: "user", content: firstUser.content },
    ];

    waitUntil(updateTitle(input, threadId));

    return NextResponse.json({ ok: true });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error("[Regenerate Title Error]: " + error.message);
    return NextResponse.json({ error: { message: error.message } }, { status: 500 });
  }
});
