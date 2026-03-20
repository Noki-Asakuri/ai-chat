import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { useMutation } from "convex/react";
import { PlusIcon, SearchIcon } from "lucide-react";
import { memo, useCallback, useRef } from "react";
import { z } from "zod";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";

import { convexSessionQuery } from "@/lib/convex/helpers";

import { ProfileCard, type ProfileListItem } from "./profiles/-components/profile-card";
import {
  ProfilesDialogController,
  type ProfileEditSeed,
  type ProfilesDialogControllerHandle,
} from "./profiles/-components/profiles-dialog-controller";
import { SortSelect, type SortOption } from "./profiles/-components/sort-select";
import { LoadingProfilesListSkeleton } from "./profiles/-pending";

export const Route = createFileRoute("/settings/profiles")({
  validateSearch: z.object({
    q: z.string().optional(),
    sort: z.enum(["az", "za", "newest", "oldest", "recently-updated"]).optional(),
  }),
  component: AiProfilesPage,
  head: () => ({ meta: [{ title: "AI Profiles - AI Chat" }] }),
});

const ProfilesHeader = memo(function ProfilesHeader({
  search,
  onSearchChange,
  sort,
  onSortChange,
  onCreate,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  sort: SortOption;
  onSortChange: (value: SortOption) => void;
  onCreate: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-md">
        <SearchIcon className="absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search profiles…"
          className="pl-8"
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
        <SortSelect value={sort} onValueChange={onSortChange} className="w-full sm:w-48" />

        <Button type="button" onClick={onCreate} className="h-9 w-full shadow-xs sm:w-auto">
          <PlusIcon className="size-4" /> Create profile
        </Button>
      </div>
    </div>
  );
});

function ProfilesList({
  profiles,
  isLoading,
  search,
  onClearSearch,
  onCreate,
  onEdit,
  onDelete,
}: {
  profiles: Array<ProfileListItem>;
  isLoading: boolean;
  search: string;
  onClearSearch: () => void;
  onCreate: () => void;
  onEdit: (seed: ProfileEditSeed) => void;
  onDelete: (id: Id<"profiles">) => void;
}) {
  const hasSearch = search.trim().length > 0;

  if (isLoading) {
    return <LoadingProfilesListSkeleton />;
  }

  if (profiles.length === 0) {
    if (hasSearch) {
      return (
        <Empty className="rounded-md">
          <EmptyHeader>
            <EmptyTitle>No matches</EmptyTitle>
            <EmptyDescription>
              No profiles match <span className="font-medium text-foreground">“{search}”</span>.
            </EmptyDescription>
          </EmptyHeader>

          <EmptyContent>
            <Button variant="secondary" onClick={onClearSearch} className="h-9">
              Clear search
            </Button>
          </EmptyContent>
        </Empty>
      );
    }

    return (
      <Empty className="rounded-md bg-card ring-1 ring-foreground/10">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <PlusIcon className="size-4" />
          </EmptyMedia>
          <EmptyTitle>Create your first AI profile</EmptyTitle>
          <EmptyDescription>
            Profiles are reusable personas. Give it a name, a system prompt, and an optional image.
          </EmptyDescription>
        </EmptyHeader>

        <EmptyContent>
          <Button onClick={onCreate} className="h-9 shadow-xs">
            <PlusIcon className="size-4" /> Create profile
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {profiles.map((p) => (
        <ProfileCard key={p._id} profile={p} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}

function AiProfilesPage() {
  const searchParams = Route.useSearch();
  const navigate = Route.useNavigate();

  const search = searchParams.q ?? "";
  const sort = searchParams.sort ?? ("recently-updated" satisfies SortOption);

  const { data, isPending, refetch } = useQuery({
    ...convexSessionQuery(api.functions.profiles.listProfilesWithQuery, { search, sort }),
    placeholderData: keepPreviousData,
  });
  const profiles = (data ?? []) as Array<ProfileListItem>;

  const createProfile = useMutation(api.functions.profiles.createProfile);
  const updateProfile = useMutation(api.functions.profiles.updateProfile);
  const deleteProfile = useMutation(api.functions.profiles.deleteProfile);

  const dialogRef = useRef<ProfilesDialogControllerHandle | null>(null);

  const onSearchChange = useCallback(
    function onSearchChange(value: string) {
      void navigate({
        replace: true,
        search: (prev) => ({ ...prev, q: value.trim().length === 0 ? undefined : value }),
      });
    },
    [navigate],
  );

  const onSortChange = useCallback(
    function onSortChange(value: SortOption) {
      void navigate({
        replace: true,
        search: (prev) => ({ ...prev, sort: value }),
      });
    },
    [navigate],
  );

  const onClearSearch = useCallback(
    function onClearSearch() {
      void navigate({ replace: true, search: (prev) => ({ ...prev, q: undefined }) });
    },
    [navigate],
  );

  const onCreate = useCallback(function onCreate() {
    dialogRef.current?.openCreate();
  }, []);

  const onEdit = useCallback(function onEdit(seed: ProfileEditSeed) {
    dialogRef.current?.openEdit(seed);
  }, []);

  const onDelete = useCallback(
    async function onDelete(id: Id<"profiles">) {
      try {
        await deleteProfile({ profileId: id });
        void refetch();
      } catch (e) {
        console.error("[AI Profiles] delete error:", e);
      }
    },
    [deleteProfile, refetch],
  );

  return (
    <main className="space-y-4">
      <ProfilesHeader
        search={search}
        onSearchChange={onSearchChange}
        sort={sort}
        onSortChange={onSortChange}
        onCreate={onCreate}
      />

      <ProfilesList
        profiles={profiles}
        isLoading={isPending}
        search={search}
        onClearSearch={onClearSearch}
        onCreate={onCreate}
        onEdit={onEdit}
        onDelete={onDelete}
      />

      <ProfilesDialogController
        ref={dialogRef}
        createProfile={createProfile}
        updateProfile={updateProfile}
        onAfterSubmit={() => void refetch()}
      />
    </main>
  );
}
