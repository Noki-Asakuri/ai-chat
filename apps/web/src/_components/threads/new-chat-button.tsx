import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { useNavigate } from "@tanstack/react-router";
import { FolderIcon, SquarePenIcon } from "lucide-react";
import { type KeyboardEvent, useState } from "react";

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
} from "../ui/command";
import { Kbd } from "../ui/kbd";
import { Separator } from "../ui/separator";

import { threadStoreActions } from "@/lib/store/thread-store";
import type { api } from "@ai-chat/backend/convex/_generated/api";

type NewChatButtonProps = {
  groups: (typeof api.functions.groups.listGroups)["_returnType"]["groups"];
};

export function NewChatButton({ groups }: NewChatButtonProps) {
  const navigate = useNavigate();
  const [newChatOpen, setNewChatOpen] = useState(false);

  async function createNewChat(groupId: Id<"groups"> | null): Promise<void> {
    threadStoreActions.setActiveGroupId(groupId);
    setNewChatOpen(false);
    await navigate({ to: "/" });
  }

  function handleNewChatShortcut(event: KeyboardEvent<HTMLDivElement>): void {
    if ((!event.ctrlKey && !event.metaKey) || event.altKey || event.shiftKey) return;

    const shortcutNumber = Number(event.key);
    if (!Number.isInteger(shortcutNumber) || shortcutNumber < 1 || shortcutNumber > 9) return;

    if (shortcutNumber === 1) {
      event.preventDefault();
      void createNewChat(null);
      return;
    }

    const group = groups[shortcutNumber - 2];
    if (!group) return;

    event.preventDefault();
    void createNewChat(group._id);
  }

  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        aria-label="New chat"
        title="New chat"
        onClick={() => setNewChatOpen(true)}
      >
        <SquarePenIcon />
      </Button>

      <CommandDialog
        open={newChatOpen}
        onOpenChange={setNewChatOpen}
        title="Create new chat"
        description="Choose which group the new chat belongs to."
        className="h-[min(36rem,calc(100dvh-4rem))] rounded-md sm:max-w-3xl"
      >
        <Command
          className="[&_[data-slot=command-input-wrapper]]:p-2 [&_[data-slot=command-input-wrapper]_svg]:size-5! [&_[data-slot=command-input]]:text-sm! [&_[data-slot=input-group]]:h-12!"
          onKeyDown={handleNewChatShortcut}
        >
          <CommandInput placeholder="Choose a group..." />

          <CommandList className="max-h-none flex-1">
            <CommandEmpty>No groups found.</CommandEmpty>
            <CommandGroup heading="Groups" className="px-2 py-2">
              <CommandItem
                value="Ungrouped"
                className="min-h-16 gap-3 rounded-md! px-3 py-3 text-sm"
                onSelect={() => {
                  void createNewChat(null);
                }}
              >
                <FolderIcon />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate font-medium">Ungrouped</span>
                  <span className="truncate text-xs text-muted-foreground">Create without a group</span>
                </span>
                <CommandShortcut>Ctrl+1</CommandShortcut>
              </CommandItem>

              {groups.map((group, index) => (
                <CommandItem
                  key={group._id}
                  value={group.title}
                  className="min-h-16 gap-3 rounded-md! px-3 py-3 text-sm"
                  onSelect={() => {
                    void createNewChat(group._id);
                  }}
                >
                  <FolderIcon />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate font-medium">{group.title}</span>
                    <span className="truncate text-xs text-muted-foreground">Open group</span>
                  </span>
                  {index < 8 && <CommandShortcut>Ctrl+{index + 2}</CommandShortcut>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>

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
