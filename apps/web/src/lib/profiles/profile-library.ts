import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { convexQuery } from "@convex-dev/react-query";

export type ProfileLibrary = (typeof api.functions.profiles.getProfileLibrary)["_returnType"];
export type LibraryProfile = ProfileLibrary["profiles"][number];

export const profileLibraryQuery = convexQuery(api.functions.profiles.getProfileLibrary, {});

/** The profile a new chat in `groupId` (null for Ungrouped) starts with. */
export function getGroupDefaultProfileId(
  library: ProfileLibrary | undefined,
  groupId: Id<"groups"> | null,
): Id<"profiles"> | null {
  if (!library) return null;
  if (groupId === null) return library.ungroupedProfileId;
  return library.groups.find((group) => group._id === groupId)?.profileId ?? null;
}

export type ProfileDefaultPlace = { id: Id<"groups"> | "ungrouped"; title: string };

/** Where a profile is the default: Ungrouped first, then its groups. Titles can repeat; ids don't. */
export function getProfileDefaultPlaces(
  library: ProfileLibrary,
  profileId: Id<"profiles">,
): ProfileDefaultPlace[] {
  const places: ProfileDefaultPlace[] = [];
  if (library.ungroupedProfileId === profileId) places.push({ id: "ungrouped", title: "Ungrouped" });
  for (const group of library.groups) {
    if (group.profileId === profileId) places.push({ id: group._id, title: group.title });
  }
  return places;
}

export function getProfileInitials(name: string): string {
  const [first = "", second = ""] = name.trim().split(/\s+/);
  if (!first) return "?";
  if (!second) return first.slice(0, 2).toUpperCase();
  return (first.slice(0, 1) + second.slice(0, 1)).toUpperCase();
}
