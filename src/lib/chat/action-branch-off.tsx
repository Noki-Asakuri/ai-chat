import { api } from "@/convex/_generated/api";

import type { useRouter } from "next/navigation";

import { getConvexReactClient } from "../convex/client";
import type { ChatMessage } from "../types";
import { toUUID } from "../utils";

const convexClient = getConvexReactClient();

export async function handleBranchOff(message: ChatMessage, router: ReturnType<typeof useRouter>) {
  console.log("Branch off", message._creationTime);

  const newThreadId = await convexClient.mutation(api.threads.branchThread, {
    lastMessageCreatedAt: message._creationTime,
    threadId: message.threadId,
  });

  router.push(`/chat/${toUUID(newThreadId)}`);
}
