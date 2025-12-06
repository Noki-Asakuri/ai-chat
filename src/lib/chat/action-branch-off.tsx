import { api } from "@/convex/_generated/api";

import type { useNavigate } from "@tanstack/react-router";

import { getConvexReactClient } from "../convex/client";
import type { ChatMessage } from "../types";
import { toUUID } from "../utils";

const convexClient = getConvexReactClient();

export async function branchOffThreadMessage(
  message: ChatMessage,
  navigate: ReturnType<typeof useNavigate>,
) {
  console.log("Branch off", message._creationTime);

  const newThreadId = await convexClient.mutation(api.functions.threads.branchThread, {
    lastMessageCreatedAt: message._creationTime,
    threadId: message.threadId,
  });

  await navigate({ to: "/threads/$threadId", params: { threadId: toUUID(newThreadId) } });
}
