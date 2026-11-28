import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { useConfigStoreApi } from "@/components/provider/config-provider";

import { getGroupDefaultProfileId, profileLibraryQuery } from "@/lib/profiles/profile-library";
import { useThreadStore } from "@/lib/store/thread-store";

/**
 * Gives the chat its group's default profile while nothing was picked by hand. A hand-picked
 * profile stays even when the defaults change in another tab; moving to another group starts over
 * with that group's default. Starting a new chat remounts the config store, which clears the pick.
 *
 * It lives inside the config store rather than in the chat layout, so profile library updates
 * only ever touch the profile and never re-apply the layout's other settings.
 */
function ChatProfileDefault({ groupId }: { groupId: Id<"groups"> | null }) {
  const store = useConfigStoreApi();
  const { data: library } = useQuery(profileLibraryQuery);
  const appliedGroup = useRef<{ groupId: Id<"groups"> | null } | null>(null);

  const defaultProfileId = library ? getGroupDefaultProfileId(library, groupId) : undefined;

  useEffect(() => {
    if (defaultProfileId === undefined) return;

    const groupChanged = appliedGroup.current !== null && appliedGroup.current.groupId !== groupId;
    appliedGroup.current = { groupId };
    store.getState().applyDefaultProfile(defaultProfileId, { force: groupChanged });
  }, [store, defaultProfileId, groupId]);

  return null;
}

/** A new chat belongs to whichever group the sidebar has active. */
export function NewChatProfileDefault() {
  const activeGroupId = useThreadStore((state) => state.activeGroupId);
  return <ChatProfileDefault groupId={activeGroupId} />;
}

/** A thread that never saved a profile uses its own group's default. */
export function ThreadProfileDefault({ groupId }: { groupId: Id<"groups"> | null }) {
  return <ChatProfileDefault groupId={groupId} />;
}
