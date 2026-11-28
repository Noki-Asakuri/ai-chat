import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";
import { api } from "@ai-chat/backend/convex/_generated/api";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxList,
  ComboboxTrigger,
  createComboboxController,
} from "@ui-sdk/react/combobox";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { CheckIcon, ChevronDownIcon, SearchIcon, Settings2Icon, UserRoundIcon, UserRoundXIcon } from "lucide-react";
import { useRef, useState } from "react";

import { convexQuery } from "@convex-dev/react-query";

import { useConfigStore } from "@/components/provider/config-provider";
import { ProfileAvatar } from "@/components/profiles/profile-avatar";
import { buttonVariants } from "@/components/ui/button";

import { useSetChatProfile } from "@/lib/chat/use-chat-settings";
import {
  getGroupDefaultProfileId,
  profileLibraryQuery,
  type LibraryProfile,
  type ProfileLibrary,
} from "@/lib/profiles/profile-library";
import { useThreadStore } from "@/lib/store/thread-store";
import { cn, fromUUID } from "@/lib/utils";

import { composerControlClassName } from "./composer-control";

const NO_PROFILE = "none";

// Closing by tabbing or clicking elsewhere already put focus where the person wanted it.
const RESTORE_FOCUS_REASONS = new Set(["item-press", "escape-key", "trigger-press", "close-press"]);

// The search box sits inside the popup, so Tab from it lands on the settings link in the same
// popup; the combobox still reports that as focus leaving and would close.
function focusStaysInPopup(content: HTMLElement | null, event: Event | undefined): boolean {
  if (!content || !event) return false;
  if (event instanceof FocusEvent) {
    return event.relatedTarget instanceof Node && content.contains(event.relatedTarget);
  }
  return (
    event instanceof KeyboardEvent &&
    event.key === "Tab" &&
    !event.shiftKey &&
    event.target instanceof Node &&
    content.contains(event.target)
  );
}

/** The chat's profile, the library it comes from and the profile its group starts with. */
export function useChatProfile() {
  const profileId = useConfigStore((state) => state.modelParams.profile);
  const { data: library } = useQuery(profileLibraryQuery);
  const params = useParams({ from: "/_chat/threads/$threadId", shouldThrow: false });
  const threadId = fromUUID<Id<"threads">>(params?.threadId);
  const activeGroupId = useThreadStore((state) => state.activeGroupId);
  const { data: threadMeta } = useQuery(
    convexQuery(api.functions.threads.getThreadPageMeta, threadId ? { threadId } : "skip"),
  );

  // A thread belongs to its own group (null is Ungrouped), whatever the sidebar is showing.
  const groupId = threadId ? (threadMeta?.groupId ?? null) : activeGroupId;
  // A deleted profile can still be saved on an old thread; it sends nothing, so show it as none.
  const profile = library?.profiles.find((item) => item._id === profileId) ?? null;

  return {
    library,
    profile,
    defaultProfileId: getGroupDefaultProfileId(library, groupId),
    groupTitle: getGroupTitle(library, groupId),
  };
}

function getGroupTitle(library: ProfileLibrary | undefined, groupId: Id<"groups"> | null): string {
  if (groupId === null) return "Ungrouped";
  return library?.groups.find((group) => group._id === groupId)?.title ?? "this group";
}

/** Choose which AI profile answers in this chat. Hidden until there is a profile to choose. */
export function ChatProfilePicker({ className }: { className?: string }) {
  const { library, profile, defaultProfileId, groupTitle } = useChatProfile();
  const setChatProfile = useSetChatProfile();
  const params = useParams({ from: "/_chat/threads/$threadId", shouldThrow: false });
  // Choosing the profile already shown changes nothing, so the combobox reports no value change.
  // It is still a choice made by hand, which a later default must not replace.
  const pickedThisOpen = useRef(false);

  const [query, setQuery] = useState("");
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null);
  const [content, setContent] = useState<HTMLDivElement | null>(null);
  const closeReason = useRef<string | null>(null);
  const [combobox] = useState(() => createComboboxController());

  const profiles = library?.profiles ?? [];
  if (profiles.length === 0) return null;

  // The group's default first, so the usual choice is one keystroke away.
  const ordered = defaultProfileId
    ? profiles.toSorted((a, b) => Number(b._id === defaultProfileId) - Number(a._id === defaultProfileId))
    : profiles;

  function itemToLabel(value: string): string {
    if (value === NO_PROFILE) return "No profile";
    return profiles.find((item) => item._id === value)?.name ?? "Unknown profile";
  }

  return (
    <Combobox
      controller={combobox}
      value={profile?._id ?? NO_PROFILE}
      onValueChange={(nextValue) => {
        if (!nextValue) return;
        pickedThisOpen.current = true;
        const next = nextValue === NO_PROFILE ? null : profiles.find((item) => item._id === nextValue)?._id;
        if (next !== undefined) setChatProfile(next);
      }}
      query={query}
      onQueryChange={setQuery}
      onOpenChange={(open, details) => {
        if (!open && details.reason === "focus-out" && focusStaysInPopup(content, details.event)) {
          details.cancel();
          return;
        }
        if (open) {
          setQuery("");
          pickedThisOpen.current = false;
          return;
        }
        closeReason.current = details.reason;
        if (details.reason === "item-press" && !pickedThisOpen.current) setChatProfile(profile?._id ?? null);
      }}
      onOpenChangeComplete={(open) => {
        if (open) {
          if (!content?.contains(document.activeElement)) combobox.focus();
          return;
        }
        const focused = document.activeElement;
        const focusIsLost = !focused || focused === document.body || content?.contains(focused);
        if (focusIsLost && closeReason.current && RESTORE_FOCUS_REASONS.has(closeReason.current)) {
          trigger?.focus();
        }
      }}
      itemToLabel={itemToLabel}
      autoHighlight="always"
    >
      <ComboboxTrigger
        ref={setTrigger}
        aria-label={profile ? `Profile: ${profile.name}` : "Choose a profile"}
        title={profile ? `Profile: ${profile.name}` : "Choose a profile"}
        data-active={profile !== null}
        className={cn(
          buttonVariants({ variant: "ghost" }),
          composerControlClassName,
          "flex min-w-0 cursor-pointer items-center data-[active=true]:text-foreground",
          profile && "pl-1",
          className,
        )}
      >
        {profile ? (
          <ProfileAvatar
            name={profile.name}
            imageKey={profile.imageKey}
            className="size-6"
            fallbackClassName="text-[10px]"
          />
        ) : (
          <UserRoundIcon aria-hidden="true" />
        )}
        <span className="max-w-32 truncate">{profile ? profile.name : "Profile"}</span>
        <ChevronDownIcon aria-hidden="true" className="size-3.5 shrink-0 opacity-60" />
      </ComboboxTrigger>

      <ComboboxContent
        ref={setContent}
        anchor={trigger}
        sideOffset={8}
        collisionPadding={8}
        onBlur={(event) => {
          const next = event.relatedTarget;
          if (next instanceof Node && next !== trigger && !content?.contains(next)) combobox.close();
        }}
        className={cn(
          "z-50 m-0 flex w-[min(22rem,calc(100vw-1rem))] flex-col overflow-hidden p-0",
          "rounded-lg border border-border bg-card text-card-foreground shadow-md ring-1 ring-foreground/8",
          "origin-(--transform-origin) duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
        )}
      >
        <div className="border-b border-border px-3 py-2.5">
          <div className="flex h-9 items-center gap-2 rounded-md border border-input bg-background/70 px-2.5 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
            <SearchIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            <ComboboxInput
              aria-label="Search profiles"
              placeholder="Search profiles..."
              autoComplete="off"
              spellCheck={false}
              className="h-full min-w-0 flex-1 bg-transparent text-xs outline-hidden placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <ComboboxList
          aria-label="Profiles"
          tabIndex={-1}
          className="max-h-[min(22rem,calc(100vh-14rem))] min-h-0 [scrollbar-gutter:stable_both-edges] overflow-y-auto px-1.5 py-1.5"
        >
          <ComboboxEmpty className="px-2 py-6 text-center text-xs text-muted-foreground not-data-empty:hidden">
            No profiles match your search.
          </ComboboxEmpty>

          <ComboboxItem value={NO_PROFILE} label="No profile" className={itemClassName}>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground">
              <UserRoundXIcon aria-hidden="true" className="size-4" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-xs font-medium">No profile</span>
              <span className="truncate text-[11px] text-muted-foreground">Only your global instruction</span>
            </span>
            <ItemCheck />
          </ComboboxItem>

          {ordered.map((item) => (
            <ProfileItem
              key={item._id}
              profile={item}
              isDefault={item._id === defaultProfileId}
              groupTitle={groupTitle}
            />
          ))}
        </ComboboxList>

        <div className="flex items-center gap-2 border-t border-border px-1.5 py-1.5">
          <Link
            to="/settings/profiles"
            // So "Back to chat" in Settings returns to this thread.
            search={{ rt: params?.threadId }}
            className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md px-2.5 text-xs text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <Settings2Icon aria-hidden="true" className="size-3.5 shrink-0" />
            <span className="truncate">Manage profiles and group defaults</span>
          </Link>
        </div>
      </ComboboxContent>
    </Combobox>
  );
}

const itemClassName = cn(
  "mt-0.5 flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 outline-none select-none first:mt-0",
  "data-highlighted:bg-muted/70 data-highlighted:text-foreground",
  "data-selected:bg-primary/10 data-selected:text-foreground",
);

function ItemCheck() {
  return (
    <ComboboxItemIndicator className="shrink-0 text-primary">
      <CheckIcon aria-hidden="true" className="size-4" />
    </ComboboxItemIndicator>
  );
}

function ProfileItem({
  profile,
  isDefault,
  groupTitle,
}: {
  profile: LibraryProfile;
  isDefault: boolean;
  groupTitle: string;
}) {
  const preview = profile.systemPrompt.replace(/\s+/g, " ").trim();

  return (
    <ComboboxItem
      value={profile._id}
      label={profile.name}
      keywords={[preview.slice(0, 200)]}
      className={itemClassName}
    >
      <ProfileAvatar name={profile.name} imageKey={profile.imageKey} fallbackClassName="text-[11px]" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-xs font-medium">{profile.name}</span>
          {isDefault && (
            <span
              title={`New chats in ${groupTitle} start with this profile`}
              className="shrink-0 rounded-full bg-primary/12 px-1.5 py-px text-[10px] font-medium text-primary"
            >
              Default
            </span>
          )}
        </span>
        <span className="truncate text-[11px] text-muted-foreground">{preview}</span>
      </span>
      <ItemCheck />
    </ComboboxItem>
  );
}
