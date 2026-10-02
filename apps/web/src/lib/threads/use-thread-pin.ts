import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMutation } from "convex/react";

// All pin controls use the same confirmation preference, including bulk actions.
export function useThreadPin() {
  const { data } = useSuspenseQuery(convexQuery(api.functions.users.getCurrentUserPreferences));
  const pinThread = useMutation(api.functions.threads.pinThread);

  return async (args: { threadId: Id<"threads">; pinned: boolean }, confirmed = false) => {
    if (!args.pinned && data.confirmations?.unpin && !confirmed && !window.confirm("Unpin this thread?"))
      return;
    await pinThread(args);
  };
}
