import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { useNavigate } from "@tanstack/react-router";
import { FolderIcon, SquarePenIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "../ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
  rankItems,
} from "../ui/command";
import { Kbd } from "../ui/kbd";
import { Separator } from "../ui/separator";

import { TOOLBAR_BUTTON } from "./sidebar-scale";

import { threadStoreActions } from "@/lib/store/thread-store";
import type { api } from "@ai-chat/backend/convex/_generated/api";

type NewChatButtonProps = {
  groups: (typeof api.functions.groups.listGroups)["_returnType"]["groups"];
};

export function NewChatButton({ groups }: NewChatButtonProps) {
  const navigate = useNavigate();
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [query, setQuery] = useState("");

  async function createNewChat(groupId: Id<"groups"> | null): Promise<void> {
    threadStoreActions.setActiveGroupId(groupId);
    setNewChatOpen(false);
    await navigate({ to: "/" });
  }

  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        className={TOOLBAR_BUTTON}
        aria-label="New chat"
        title="New chat"
        onClick={() => setNewChatOpen(true)}
      >
        <SquarePenIcon />
      </Button>

      <CommandDialog
        open={newChatOpen}
        onOpenChange={setNewChatOpen}
        // The button opens it by setting state directly, so reset once it has closed instead.
        onOpenChangeComplete={(open) => {
          if (!open) setQuery("");
        }}
        title="Create new chat"
        description="Choose which group the new chat belongs to."
        className="h-[min(36rem,calc(100dvh-4rem))] sm:max-w-3xl"
      >
        <Command loop query={query} onQueryChange={setQuery}>
          <CommandInput
            aria-label="Search groups"
            placeholder="Choose a group..."
            wrapperClassName="h-14 px-4 [&_svg]:size-5!"
            className="text-sm"
          />

          <CommandList className="max-h-none flex-1">
            <CommandGroup heading="Groups" className="px-2 py-2">
              <CommandItem
                value="ungrouped"
                label="Ungrouped"
                shortcut="mod+1"
                className="min-h-16 gap-3 px-3 py-3 text-sm"
                onSelect={() => createNewChat(null)}
              >
                <FolderIcon aria-hidden="true" />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate font-medium">Ungrouped</span>
                  <span className="truncate text-xs text-muted-foreground">Create without a group</span>
                </span>
                <CommandShortcut />
              </CommandItem>

              {rankItems(groups, query, (group) => ({ value: group._id, label: group.title })).map(
                (group) => {
                  const index = groups.indexOf(group);
                  return (
                    <CommandItem
                      key={group._id}
                      value={group._id}
                      label={group.title}
                      shortcut={index < 8 ? `mod+${index + 2}` : undefined}
                      className="min-h-16 gap-3 px-3 py-3 text-sm"
                      onSelect={() => createNewChat(group._id)}
                    >
                      <FolderIcon aria-hidden="true" />
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate font-medium">{group.title}</span>
                        <span className="truncate text-xs text-muted-foreground">Open group</span>
                      </span>
                      <CommandShortcut />
                    </CommandItem>
                  );
                },
              )}
            </CommandGroup>
          </CommandList>
          <CommandEmpty>No groups found.</CommandEmpty>

          <Separator />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd>
              Navigate
            </span>

            <span className="flex items-center gap-1.5">
              <Kbd>Enter</Kbd>
              Select
            </span>

            <span className="flex items-center gap-1.5">
              <Kbd>Esc</Kbd>
              Close
            </span>
          </div>
        </Command>
      </CommandDialog>
    </>
  );
}
