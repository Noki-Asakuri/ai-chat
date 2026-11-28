import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { useMutation } from "convex/react";
import { FolderIcon, InboxIcon, UserRoundXIcon } from "lucide-react";

import { ProfileAvatar } from "@/components/profiles/profile-avatar";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";

import type { ProfileLibrary } from "@/lib/profiles/profile-library";

const NO_PROFILE = "none";

/** One row per group: the profile its new chats start with. */
export function GroupDefaults({ library }: { library: ProfileLibrary }) {
  const setGroupDefaultProfile = useMutation(
    api.functions.profiles.setGroupDefaultProfile,
  ).withOptimisticUpdate((localStore, args) => {
    const current = localStore.getQuery(api.functions.profiles.getProfileLibrary, {});
    if (!current) return;
    localStore.setQuery(
      api.functions.profiles.getProfileLibrary,
      {},
      args.groupId === null
        ? { ...current, ungroupedProfileId: args.profileId }
        : {
            ...current,
            groups: current.groups.map((group) =>
              group._id === args.groupId ? Object.assign({}, group, { profileId: args.profileId }) : group,
            ),
          },
    );
  });

  async function handleChange(groupId: Id<"groups"> | null, value: string) {
    const profileId =
      value === NO_PROFILE ? null : (library.profiles.find((profile) => profile._id === value)?._id ?? null);
    try {
      await setGroupDefaultProfile({ groupId, profileId });
    } catch (error) {
      toast.error("Couldn't change the group default", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  const rows: Array<{ id: Id<"groups"> | null; title: string; profileId: Id<"profiles"> | null }> = [
    { id: null, title: "Ungrouped", profileId: library.ungroupedProfileId },
    ...library.groups.map((group) => ({ id: group._id, title: group.title, profileId: group.profileId })),
  ];

  return (
    <ul className="divide-y overflow-hidden rounded-lg border bg-card">
      {rows.map((row) => (
        <li key={row.id ?? "ungrouped"} className="flex items-center gap-3 px-4 py-2.5">
          <span className="text-muted-foreground">
            {row.id === null ? (
              <InboxIcon aria-hidden="true" className="size-4" />
            ) : (
              <FolderIcon aria-hidden="true" className="size-4" />
            )}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm">{row.title}</span>

          <GroupProfileSelect
            label={`Default profile for ${row.title}`}
            library={library}
            value={row.profileId}
            onChange={(value) => void handleChange(row.id, value)}
          />
        </li>
      ))}
    </ul>
  );
}

function GroupProfileSelect({
  label,
  library,
  value,
  onChange,
}: {
  label: string;
  library: ProfileLibrary;
  value: Id<"profiles"> | null;
  onChange: (value: string) => void;
}) {
  const selected = library.profiles.find((profile) => profile._id === value) ?? null;

  return (
    <Select
      value={selected?._id ?? NO_PROFILE}
      onValueChange={(next) => {
        if (next !== null) onChange(next);
      }}
    >
      <SelectTrigger aria-label={label} className="h-8 w-44 shrink-0 text-xs sm:w-56">
        <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
          {selected ? (
            <>
              <ProfileAvatar
                name={selected.name}
                imageKey={selected.imageKey}
                className="size-5"
                fallbackClassName="text-[9px]"
              />
              <span className="truncate">{selected.name}</span>
            </>
          ) : (
            <span className="truncate text-muted-foreground">No profile</span>
          )}
        </span>
      </SelectTrigger>

      <SelectContent>
        <SelectItem value={NO_PROFILE}>
          <UserRoundXIcon className="size-4 text-muted-foreground" />
          No profile
        </SelectItem>
        {library.profiles.map((profile) => (
          <SelectItem key={profile._id} value={profile._id}>
            <ProfileAvatar
              name={profile.name}
              imageKey={profile.imageKey}
              className="size-5"
              fallbackClassName="text-[9px]"
            />
            <span className="truncate">{profile.name}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
