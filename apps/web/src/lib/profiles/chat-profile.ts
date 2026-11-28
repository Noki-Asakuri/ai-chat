import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { getGroupDefaultProfileId, type ProfileLibrary } from "./profile-library";

/** The profile a chat starts with, and whether it was picked by hand. */
export type InitialChatProfile = { profile: Id<"profiles"> | null; chosen: boolean };

/** A profile picked by hand on a new chat that hasn't been sent yet. */
export type RememberedNewChatProfile = {
  newChatKey: number;
  groupId: Id<"groups"> | null;
  profileId: Id<"profiles"> | null;
};

/**
 * What a new chat starts with: a profile picked by hand for this same new chat and group (so it
 * survives leaving for Settings and coming back), otherwise the group's default.
 * Undefined while the profiles aren't loaded and nothing was picked.
 */
export function getNewChatInitialProfile({
  library,
  groupId,
  newChatKey,
  remembered,
}: {
  library: ProfileLibrary | undefined;
  groupId: Id<"groups"> | null;
  newChatKey: number;
  remembered: RememberedNewChatProfile | null;
}): InitialChatProfile | undefined {
  if (remembered && remembered.newChatKey === newChatKey && remembered.groupId === groupId) {
    return { profile: remembered.profileId, chosen: true };
  }
  if (!library) return undefined;
  return { profile: getGroupDefaultProfileId(library, groupId), chosen: false };
}

/**
 * The profile a message is sent with. A profile named in the message or picked by hand wins.
 * A new chat, or a thread that never saved a profile, uses its group's default, read from the
 * profiles as they are now. If they can't be loaded this throws, so the message isn't sent and
 * saved with no profile when its group has one.
 */
export async function resolveMessageProfile({
  messageProfileId,
  currentProfileId,
  chosen,
  needsGroupDefault,
  groupId,
  loadLibrary,
}: {
  messageProfileId: Id<"profiles"> | null;
  currentProfileId: Id<"profiles"> | null;
  chosen: boolean;
  needsGroupDefault: boolean;
  groupId: Id<"groups"> | null;
  loadLibrary: () => Promise<ProfileLibrary>;
}): Promise<Id<"profiles"> | null> {
  if (messageProfileId) return messageProfileId;
  if (chosen || !needsGroupDefault) return currentProfileId;
  return getGroupDefaultProfileId(await loadLibrary(), groupId);
}
