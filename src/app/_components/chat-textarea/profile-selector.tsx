import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { BrainIcon, CheckIcon, PlusIcon, SearchIcon, SquareUserIcon, XIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";

import { Button, buttonVariants } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { Input } from "../ui/input";

import { useChatStore } from "@/lib/chat/store";
import { cn } from "@/lib/utils";

export function ProfileSelectorButton() {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const profile = useChatStore((s) => s.chatConfig.profile);

  const { data } = useQuery(
    convexQuery(api.functions.aiProfiles.listProfiles, { search, sort: "recently-updated" }),
  );

  const currentLabel = useMemo(() => {
    if (!profile.id) return "No Profile";

    const p = data?.find((x) => x._id === profile.id);
    return p?.name ?? "Profile";
  }, [data, profile.id]);

  function handleChooseNone() {
    useChatStore.getState().setChatConfig({ profile: { id: null, systemPrompt: "" } });
    setOpen(false);
  }

  function handleChooseProfile(id: Id<"ai_profiles">, systemPrompt: string) {
    useChatStore.getState().setChatConfig({ profile: { id, systemPrompt } });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className={cn(
          "hover:!bg-primary/15 flex h-9 cursor-pointer items-center justify-between gap-2 border px-2 py-1.5 text-xs",
          buttonVariants({ variant: "ghost" }),
        )}
      >
        <div className="flex items-center justify-center gap-2">
          <SquareUserIcon className="size-4" />
          <span className="w-max">{currentLabel}</span>
        </div>
      </DialogTrigger>

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Select AI Profile</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="relative flex-1" role="search">
              <SearchIcon className="-translate-y-1/2 absolute top-1/2 left-2 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search AI profiles…"
                aria-label="Search AI profiles"
                className="h-8 pl-8"
              />
            </div>

            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="h-8 w-8 shrink-0"
              title="Create AI Profile"
              onMouseDown={async () => {
                setOpen(false);
                router.push("/settings/ai-profiles");
              }}
            >
              <PlusIcon className="size-4" />
              <span className="sr-only">Create AI Profile</span>
            </Button>
          </div>

          <div
            className="custom-scroll max-h-[360px] overflow-y-auto rounded-md border py-2"
            style={{ scrollbarGutter: "stable both-edges" }}
          >
            <button
              type="button"
              onClick={handleChooseNone}
              className={cn(
                "flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted",
                { "bg-primary/10": !profile.id },
              )}
            >
              <div className="flex min-w-0 flex-col">
                <span className="flex items-center gap-2">
                  <XIcon className="size-4" />
                  <span className="truncate font-medium">No Profile</span>
                </span>
                <span className="line-clamp-1 text-muted-foreground text-xs">
                  Default profile, no system prompt
                </span>
              </div>

              {!profile.id ? <CheckIcon className="size-4" /> : null}
            </button>

            <div className="my-2 h-px w-full bg-border" />

            {data?.map((p) => {
              const isActive = p._id === profile.id;

              return (
                <button
                  key={p._id}
                  type="button"
                  onClick={() => handleChooseProfile(p._id, p.systemPrompt)}
                  className={cn(
                    "flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted",
                    { "bg-primary/10": isActive },
                  )}
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{p.name}</span>
                    <span className="line-clamp-1 text-muted-foreground text-xs">
                      {p.systemPrompt}
                    </span>
                  </div>

                  {isActive ? <CheckIcon className="size-4" /> : null}
                </button>
              );
            })}

            {data?.length === 0 && (
              <div className="px-3 py-6 text-center text-muted-foreground text-sm">
                No profiles found.
              </div>
            )}
          </div>

          <div className="flex items-center justify-end">
            <Button type="button" variant="secondary" onMouseDown={() => setOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
