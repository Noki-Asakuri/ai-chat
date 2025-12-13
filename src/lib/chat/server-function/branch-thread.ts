import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { useNavigate } from "@tanstack/react-router";
import { useSessionId } from "convex-helpers/react/sessions";
import { useConvex } from "convex/react";

import { messageStoreActions } from "@/lib/store/messages-store";
import { toUUID } from "@/lib/utils";

export function useBranchThread() {
  const navigate = useNavigate();
  const convexClient = useConvex();

  const [id] = useSessionId();

  async function branchThread(assistantMessageId: Id<"messages">) {
    const sessionId = id!;

    const threadId = messageStoreActions.getCurrentThreadId();
    if (!threadId) return;

    const newThreadId = await convexClient.mutation(api.functions.threads.branchThread, {
      threadId,
      sessionId,
      assistantMessageId,
    });

    await navigate({ to: "/threads/$threadId", params: { threadId: toUUID(newThreadId) } });
  }

  return { branchThread };
}
