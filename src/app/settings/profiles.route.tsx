import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import {
  ArrowDownAZIcon,
  ArrowUpZAIcon,
  CalendarArrowUpIcon,
  ClockArrowDownIcon,
  ClockArrowUpIcon,
  EditIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react";
import { useMemo, useState } from "react";

import { convexQuery } from "@convex-dev/react-query";
import { useSessionId, useSessionMutation } from "convex-helpers/react/sessions";

import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { uploadAiProfileImage } from "@/lib/convex/uploadFiles";
import { convexSessionQuery } from "@/lib/convex/helpers";

export const Route = createFileRoute("/settings/profiles")({
  component: AiProfilesPage,
  pendingComponent: LoadingSkeleton,

  head: () => ({ meta: [{ title: "AI Profiles - AI Chat" }] }),
  loader: async ({ context }) => {
    context.queryClient.ensureQueryData(
      convexQuery(api.functions.profiles.listProfiles, {
        search: "",
        sort: "recently-updated",
        sessionId: context.sessionId,
      }),
    );
  },
});

function LoadingSkeleton() {
  return (
    <main className="space-y-4">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold">AI Profiles</h2>
        <p className="text-muted-foreground">Create reusable AI personas for your chats.</p>
      </div>

      <p className="text-sm text-muted-foreground">Loading profiles…</p>
    </main>
  );
}

type SortOption = "az" | "za" | "newest" | "oldest" | "recently-updated";

function AiProfilesPage() {
  const [sessionId] = useSessionId();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("recently-updated");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<Id<"profiles"> | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data, refetch } = useSuspenseQuery(
    convexSessionQuery(api.functions.profiles.listProfiles, { search, sort }),
  );

  const profiles = data ?? [];

  const resetForm = () => {
    setName("");
    setSystemPrompt("");
    setFile(null);
    setEditingId(null);
  };

  function onCreateClicked() {
    resetForm();
    setEditingId(null);
    setDialogOpen(true);
  }

  function onEditClicked(profile: { _id: Id<"profiles">; name: string; systemPrompt: string }) {
    setEditingId(profile._id);
    setName(profile.name);
    setSystemPrompt(profile.systemPrompt);
    setFile(null);
    setDialogOpen(true);
  }

  const createProfile = useSessionMutation(api.functions.profiles.createProfile);
  const updateProfile = useSessionMutation(api.functions.profiles.updateProfile);
  const deleteProfile = useSessionMutation(api.functions.profiles.deleteProfile);

  async function onSubmit() {
    if (!name.trim() || !systemPrompt.trim()) return;
    setIsSubmitting(true);

    try {
      let imageKey: string | undefined | null = undefined;
      if (file) {
        if (!sessionId) throw new Error("Not authenticated");
        imageKey = await uploadAiProfileImage(file, sessionId);
      }

      if (editingId) {
        await updateProfile({ profileId: editingId, name, systemPrompt, imageKey: imageKey });
      } else {
        await createProfile({ name, systemPrompt, imageKey: imageKey });
      }

      setDialogOpen(false);
      resetForm();
      void refetch();
    } catch (e) {
      console.error("[AI Profiles] submit error:", e);
    }

    setIsSubmitting(false);
  }

  async function onConfirmDelete(id: Id<"profiles">) {
    try {
      await deleteProfile({ profileId: id });
      void refetch();
    } catch (e) {
      console.error("[AI Profiles] delete error:", e);
    }
  }

  const SortControl = useMemo(() => {
    return (
      <Select onValueChange={(v: SortOption) => setSort(v)} value={sort}>
        <SelectTrigger className="h-9 w-48 text-xs">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>

        <SelectContent>
          <SelectItem value="az">
            <ArrowDownAZIcon className="size-4" />
            <span>A-Z</span>
          </SelectItem>

          <SelectItem value="za">
            <ArrowUpZAIcon className="size-4" />
            <span>Z-A</span>
          </SelectItem>

          <SelectItem value="newest">
            <ClockArrowUpIcon className="size-4" />
            <span>Newest</span>
          </SelectItem>

          <SelectItem value="oldest">
            <ClockArrowDownIcon className="size-4" />
            <span>Oldest</span>
          </SelectItem>

          <SelectItem value="recently-updated">
            <CalendarArrowUpIcon className="size-4" />
            <span>Recently Updated</span>
          </SelectItem>
        </SelectContent>
      </Select>
    );
  }, [sort]);

  return (
    <main className="space-y-4">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold">AI Profiles</h2>
        <p className="text-muted-foreground">Create reusable AI personas for your chats.</p>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="relative w-full max-w-md">
          <SearchIcon className="absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search profiles…"
            className="pl-8"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:block">{SortControl}</div>

          <Button type="button" onMouseDown={onCreateClicked} className="h-9">
            <PlusIcon className="size-4" /> Create
          </Button>
        </div>
      </div>

      <div className="block sm:hidden">{SortControl}</div>

      {profiles.length === 0 ? (
        <p className="text-sm text-muted-foreground">No profiles found.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {profiles.map((p) => (
            <ProfileCard
              key={p._id}
              profile={p}
              onEdit={onEditClicked}
              onDelete={onConfirmDelete}
            />
          ))}
        </div>
      )}

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>{editingId ? "Edit Profile" : "Create Profile"}</AlertDialogTitle>
          </AlertDialogHeader>

          <div className="flex flex-col gap-3 py-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm">Name</span>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Helpful Researcher"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm">System Prompt</span>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={6}
                className="rounded-md border bg-transparent p-2 text-sm outline-none"
                placeholder="Describe how this AI should behave…"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm">Optional Image</span>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setFile(f);
                }}
              />

              <span className="text-xs text-muted-foreground">PNG, JPG, or WebP.</span>
            </label>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isSubmitting || !name.trim() || !systemPrompt.trim()}
              onClick={() => void onSubmit()}
            >
              {editingId ? "Save" : "Create"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

function ProfileCard({
  profile,
  onEdit,
  onDelete,
}: {
  profile: {
    _id: Id<"profiles">;
    name: string;
    systemPrompt: string;
    imageKey?: string;
    createdAt: number;
    updatedAt: number;
  };
  onEdit: (p: { _id: Id<"profiles">; name: string; systemPrompt: string }) => void;
  onDelete: (id: Id<"profiles">) => void;
}) {
  const imageUrl =
    profile.imageKey && profile.imageKey.length > 0
      ? `https://ik.imagekit.io/gmethsnvl/ai-chat/${profile.imageKey}`
      : null;

  const shortDesc =
    profile.systemPrompt.length > 140
      ? profile.systemPrompt.slice(0, 140) + "…"
      : profile.systemPrompt;

  return (
    <Card className="rounded-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base font-semibold">{profile.name}</CardTitle>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-8 w-8"
            onMouseDown={() =>
              onEdit({ _id: profile._id, name: profile.name, systemPrompt: profile.systemPrompt })
            }
            title="Edit"
          >
            <EditIcon className="size-4" />
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="h-8 w-8"
                title="Delete"
              >
                <Trash2Icon className="size-4" />
              </Button>
            </AlertDialogTrigger>

            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete “{profile.name}”?</AlertDialogTitle>
              </AlertDialogHeader>
              <p className="text-sm text-muted-foreground">
                This action cannot be undone. This will permanently delete this AI profile.
              </p>

              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(profile._id)}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardHeader>

      <CardContent className="flex items-start gap-3">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={profile.name}
            className="h-16 w-16 shrink-0 rounded-md object-cover"
          />
        ) : (
          <div className="h-16 w-16 shrink-0 rounded-md bg-muted" />
        )}

        <div className="text-sm text-foreground/80">{shortDesc || "No description"}</div>
      </CardContent>
    </Card>
  );
}
