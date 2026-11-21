import { api } from "@ai-chat/backend/convex/_generated/api";

import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";

import { useThreadStore } from "@/lib/store/thread-store";

export function useThreadGroups() {
  const activeGroupId = useThreadStore((state) => state.activeGroupId);
  return useQuery(convexQuery(api.functions.groups.listGroups, { activeGroupId }));
}
