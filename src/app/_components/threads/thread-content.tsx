import { api } from "@/convex/_generated/api";

import { useMutation } from "convex/react";

import { Dialog } from "@base-ui-components/react/dialog";
import { useDeferredValue, useState } from "react";

import { Button } from "../ui/button";
import { Input } from "../ui/input";

export function ThreadContents() {
  const [query, setQuery] = useState<string>("");
  const deferredQuery = useDeferredValue(query);

  return (
    <>
      <div className="mx-2 mt-2 flex items-center gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search threads..."
          aria-label="Search threads"
          className="h-8"
        />
        <CreateGroupButton />
      </div>

      <ThreadList query={deferredQuery} />
    </>
  );
}

function CreateGroupButton() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");

  async function onCreate(): Promise<void> {
    const name = title.trim();
    if (name.length === 0) return;

    // TODO: Create group

    setOpen(false);
    setTitle("");
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        New Group
      </Button>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-black opacity-20 transition-[opacity] duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 dark:opacity-70" />
          <Dialog.Popup className="-translate-x-1/2 -translate-y-1/2 fixed top-1/2 left-1/2 z-50 w-[min(96vw,28rem)] rounded-lg border bg-background p-6 shadow-lg transition-all duration-150 data-[ending-style]:scale-95 data-[starting-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0">
            <div className="mb-2">
              <h2 className="font-semibold text-lg">Create group</h2>
              <p className="text-muted-foreground text-sm">Enter a group name.</p>
            </div>

            <form
              className="mt-3 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void onCreate();
              }}
            >
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Group name"
                autoFocus
              />

              <div className="flex justify-end gap-2">
                <Dialog.Close className="inline-flex h-8 items-center rounded-md border px-3 text-sm">
                  Cancel
                </Dialog.Close>

                <Button type="submit" size="sm" disabled={title.trim().length === 0}>
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

function ThreadList({ query }: { query: string }) {
  return null;
}
