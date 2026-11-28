import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PlusIcon, SearchIcon, TriangleAlertIcon, UserRoundPlusIcon, XIcon } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { z } from "zod";

import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";

import {
  getProfileDefaultPlaces,
  profileLibraryQuery,
  type LibraryProfile,
  type ProfileLibrary,
} from "@/lib/profiles/profile-library";

import { GroupDefaults } from "./profiles/-components/group-defaults";
import { ProfileCard } from "./profiles/-components/profile-card";
import { ProfileEditorDialog } from "./profiles/-components/profile-editor-dialog";
import { SortSelect, type SortOption } from "./profiles/-components/sort-select";
import { LoadingProfilesSkeleton } from "./profiles/-pending";

export const Route = createFileRoute("/settings/profiles")({
  validateSearch: z.object({
    q: z.string().optional(),
    sort: z.enum(["az", "za", "newest", "oldest", "recently-updated"]).optional(),
  }),
  loader: async ({ context }) => {
    await context.queryClient.prefetchQuery(profileLibraryQuery);
  },
  component: AiProfilesPage,
  head: () => ({ meta: [{ title: "AI Profiles - AI Chat" }] }),
});

const byName = (a: LibraryProfile, b: LibraryProfile) =>
  // A fixed locale, so the server and the browser put the cards in the same order.
  a.name.localeCompare(b.name, "en", { sensitivity: "base" });

function sortProfiles(profiles: LibraryProfile[], sort: SortOption): LibraryProfile[] {
  switch (sort) {
    case "az":
      return profiles.toSorted(byName);
    case "za":
      return profiles.toSorted((a, b) => byName(b, a));
    case "newest":
      return profiles.toSorted((a, b) => b.createdAt - a.createdAt);
    case "oldest":
      return profiles.toSorted((a, b) => a.createdAt - b.createdAt);
    default:
      return profiles.toSorted((a, b) => b.updatedAt - a.updatedAt);
  }
}

function filterProfiles(profiles: LibraryProfile[], search: string): LibraryProfile[] {
  const term = search.trim().toLocaleLowerCase();
  if (!term) return profiles;
  return profiles.filter(
    (profile) =>
      profile.name.toLocaleLowerCase().includes(term) ||
      profile.systemPrompt.toLocaleLowerCase().includes(term),
  );
}

function AiProfilesPage() {
  const searchParams = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: library, isError, error, refetch, isRefetching } = useQuery(profileLibraryQuery);

  const search = searchParams.q ?? "";
  const deferredSearch = useDeferredValue(search);
  const sort = searchParams.sort ?? "recently-updated";

  // The editor stays mounted while it closes, so it keeps showing the profile it had open.
  const [editor, setEditor] = useState<{ open: boolean; profile: LibraryProfile | null; session: number }>({
    open: false,
    profile: null,
    session: 0,
  });

  function openEditor(profile: LibraryProfile | null) {
    setEditor((current) => ({ open: true, profile, session: current.session + 1 }));
  }

  function onSearchChange(value: string) {
    void navigate({
      replace: true,
      search: (previous) => ({ ...previous, q: value.length === 0 ? undefined : value }),
    });
  }

  if (!library) {
    if (!isError) return <LoadingProfilesSkeleton />;
    return (
      <Empty className="rounded-lg border border-dashed py-14">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TriangleAlertIcon />
          </EmptyMedia>
          <EmptyTitle>Couldn't load your profiles</EmptyTitle>
          <EmptyDescription>{error.message}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="secondary" disabled={isRefetching} onClick={() => void refetch()}>
            {isRefetching ? "Trying again…" : "Try again"}
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  const visible = sortProfiles(filterProfiles(library.profiles, deferredSearch), sort);
  const hasProfiles = library.profiles.length > 0;

  return (
    <main className="flex flex-col gap-10">
      <SettingsSection
        id="profile-library"
        title="Your profiles"
        description="Pick one from the profile button in the composer, or type / in a message."
        actions={
          hasProfiles && (
            <Button type="button" onClick={() => openEditor(null)} className="w-full sm:w-auto">
              <PlusIcon /> New profile
            </Button>
          )
        }
      >
        {hasProfiles ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <InputGroup className="h-9 sm:max-w-sm">
                <InputGroupAddon>
                  <SearchIcon />
                </InputGroupAddon>
                <InputGroupInput
                  value={search}
                  onChange={(event) => onSearchChange(event.target.value)}
                  placeholder="Search names and instructions…"
                  aria-label="Search profiles"
                />
                {search && (
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      size="icon-xs"
                      aria-label="Clear search"
                      onClick={() => onSearchChange("")}
                    >
                      <XIcon />
                    </InputGroupButton>
                  </InputGroupAddon>
                )}
              </InputGroup>

              <SortSelect
                value={sort}
                onValueChange={(value) =>
                  void navigate({ replace: true, search: (previous) => ({ ...previous, sort: value }) })
                }
                className="w-full sm:w-auto sm:min-w-48"
              />

              <p className="text-xs text-muted-foreground tabular-nums sm:ml-auto" aria-live="polite">
                {visible.length === library.profiles.length
                  ? `${library.profiles.length} ${library.profiles.length === 1 ? "profile" : "profiles"}`
                  : `${visible.length} of ${library.profiles.length}`}
              </p>
            </div>

            {visible.length > 0 ? (
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {visible.map((profile) => (
                  <ProfileCard
                    key={profile._id}
                    profile={profile}
                    defaultPlaces={getProfileDefaultPlaces(library, profile._id)}
                    onEdit={openEditor}
                  />
                ))}
              </ul>
            ) : (
              <Empty className="rounded-lg border border-dashed">
                <EmptyHeader>
                  <EmptyTitle>No matches</EmptyTitle>
                  <EmptyDescription>
                    No profile name or instruction contains{" "}
                    <span className="font-medium text-foreground">“{deferredSearch}”</span>.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button variant="secondary" onClick={() => onSearchChange("")}>
                    Clear search
                  </Button>
                </EmptyContent>
              </Empty>
            )}
          </div>
        ) : (
          <Empty className="rounded-lg border border-dashed py-14">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UserRoundPlusIcon />
              </EmptyMedia>
              <EmptyTitle>Create your first profile</EmptyTitle>
              <EmptyDescription>
                A profile is a reusable persona, like a code reviewer or a writing coach. Make one the
                default for a group and every new chat there starts with it.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={() => openEditor(null)}>
                <PlusIcon /> New profile
              </Button>
            </EmptyContent>
          </Empty>
        )}
      </SettingsSection>

      {hasProfiles && (
        <>
          <Separator />
          <GroupDefaultsSection library={library} />
        </>
      )}

      <ProfileEditorDialog
        open={editor.open}
        onOpenChange={(open) => setEditor((current) => ({ ...current, open }))}
        profile={editor.profile}
        library={library}
        session={editor.session}
      />
    </main>
  );
}

function GroupDefaultsSection({ library }: { library: ProfileLibrary }) {
  return (
    <SettingsSection
      id="group-defaults"
      title="Group defaults"
      description="New chats in a group start with its profile. Changing the profile inside a chat only affects that chat."
    >
      <GroupDefaults library={library} />
    </SettingsSection>
  );
}
