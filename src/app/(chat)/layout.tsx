"use client";
import { api } from "@/convex/_generated/api";

import { useParams } from "next/navigation";
import { useEffect, useRef } from "react";

import { chatStore } from "@/lib/chat/store";
import { getConvexClient } from "@/lib/convex/client";

const convexClient = getConvexClient();

export default function Layout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ threadId?: string }>();
  const threadId = params.threadId ?? crypto.randomUUID();

  const unsubRef = useRef<ReturnType<typeof convexClient.onUpdate>>(null);

  useEffect(() => {
    unsubRef.current ??= convexClient.onUpdate(api.messages.getAllMessagesFromThread, { threadId }, (data) => {
      console.debug("[Convex] Syncing messages from Convex");
      chatStore.getState().setDataFromConvex(data, data.at(-1)?.status, threadId);
    });

    return () => {
      if (unsubRef.current) unsubRef.current.unsubscribe();
    };
  }, [threadId]);

  return children;
}
