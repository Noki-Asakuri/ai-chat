import { api } from "@ai-chat/backend/convex/_generated/api";

import { Dialog } from "@base-ui/react/dialog";
import { useMutation } from "convex/react";
import { FolderIcon, FolderPlusIcon, SearchIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../ui/input-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

import { NewChatButton } from "./new-chat-button";

import { threadStoreActions, useThreadStore } from "@/lib/store/thread-store";

type ThreadListToolbarProps = {
  groups: (typeof api.functions.groups.listGroups)["_returnType"]["groups"];
  searchQuery: string;
  onSearchChange: (query: string) => void;
};

export function ThreadListToolbar({ groups, searchQuery, onSearchChange }: ThreadListToolbarProps) {
  const [groupSearchQuery, setGroupSearchQuery] = useState("");
  const activeGroupId = useThreadStore((state) => state.activeGroupId);
  const activeGroup = groups.find((group) => group._id === activeGroupId);
  const filteredGroups = groups.filter((group) =>
    group.title.toLocaleLowerCase().includes(groupSearchQuery.trim().toLocaleLowerCase()),
  );

  return (
    <div className="flex items-center gap-1.5 px-2 pb-1.5">
      <InputGroup className="min-w-0 flex-1 rounded-md border-transparent bg-input/30 shadow-none">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>

        <InputGroupInput
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search"
          aria-label="Search threads in active group"
          className="font-mono text-sm placeholder:text-muted-foreground"
        />
      </InputGroup>

      <DropdownMenu
        onOpenChange={(open) => {
          if (!open) setGroupSearchQuery("");
        }}
      >
        <DropdownMenuTrigger
          render={
            <Button
              size="icon"
              variant="ghost"
              aria-label={`Select group, current group: ${activeGroup?.title ?? "Ungrouped"}`}
              title={activeGroup?.title ?? "Ungrouped"}
            >
              <FolderIcon />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-72 p-1">
          <Input
            type="search"
            value={groupSearchQuery}
            onChange={(event) => setGroupSearchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Escape" && event.key !== "ArrowDown") event.stopPropagation();
            }}
            placeholder="Search groups..."
            aria-label="Search groups"
            className="mb-1 border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => threadStoreActions.setActiveGroupId(null)}>
              <FolderIcon />
              Ungrouped
            </DropdownMenuItem>

            {filteredGroups.map((group) => (
              <DropdownMenuItem
                key={group._id}
                onClick={() => threadStoreActions.setActiveGroupId(group._id)}
              >
                <FolderIcon />
                <span className="truncate">{group.title}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateGroupButton />
      <NewChatButton groups={groups} />
    </div>
  );
}

function CreateGroupButton() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");

  const createGroup = useMutation(api.functions.groups.createGroup);

  async function onCreate(): Promise<void> {
    const trimmedTitle = title.trim();
    if (trimmedTitle.length === 0) return;

    const groupId = await createGroup({ title: trimmedTitle });
    threadStoreActions.setActiveGroupId(groupId);

    setOpen(false);
    setTitle("");
  }

  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        aria-label="Create group"
        title="Create group"
        onClick={() => setOpen(true)}
      >
        <FolderPlusIcon />
      </Button>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="data-ending-style:opacity-0ata-[starting-style]:opacity-0 fixed inset-0 z-40 bg-black opacity-20 transition-opacity duration-150 dark:opacity-70" />
          <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[min(96vw,36rem)] -translate-x-1/2 -translate-y-1/2 rounded-md border bg-background p-8 shadow-lg transition-all duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <div className="mb-2">
              <h2 className="text-lg font-semibold">Create group</h2>
              <p className="text-sm text-muted-foreground">Enter a group name.</p>
            </div>

            <form
              className="mt-3 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void onCreate();
              }}
            >
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Group name" />

              <div className="flex justify-end gap-2">
                <Dialog.Close render={<Button variant="outline" className="h-9 w-28" />}>
                  <XIcon data-icon="inline-start" />
                  Cancel
                </Dialog.Close>

                <Button type="submit" className="h-9 w-28" disabled={title.trim().length === 0}>
                  <FolderPlusIcon data-icon="inline-start" />
                  Create
                </Button>
              </div>
            </form>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
