import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { MessagesSquareIcon, SearchXIcon } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";

import { ThreadDeleteDialog } from "@/components/threads/thread-delete-dialog";
import { ThreadShareDialog } from "@/components/threads/thread-share-dialog";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { toast } from "@/components/ui/toast";

import { getGroupColors } from "./group-colors";
import { LibraryBulkBar, type BulkAction } from "./library-bulk-bar";
import { BulkDeleteDialog, RenameThreadDialog } from "./library-dialogs";
import { LibraryOverview } from "./library-overview";
import {
  ALL_GROUPS,
  LIBRARY_FILTER_KEYS,
  UNGROUPED,
  LIBRARY_SEARCH_DEFAULTS,
  getViewCounts,
  isFinished,
  isRunning,
  matchesFilters,
  matchesView,
  paginate,
  sortThreads,
  type LibrarySearch,
  type LibraryThread,
} from "./library-search";
import { LibraryTable, type ThreadRowActions } from "./library-table";
import { LibraryToolbar } from "./library-toolbar";

import { useThreadPin } from "@/lib/threads/use-thread-pin";
import { regenerateThreadTitle } from "@/lib/trpc/client";
import { tryCatch } from "@/lib/utils";

const routeApi = getRouteApi("/settings/threads");

// The bulk mutation accepts this many threads per call.
const BULK_CHUNK_SIZE = 500;

type RowDialog = { type: "rename" | "share" | "delete"; thread: LibraryThread } | null;

const BULK_VERBS = {
  pin: { done: "Pinned", failed: "pin" },
  unpin: { done: "Unpinned", failed: "unpin" },
  settle: { done: "Settled", failed: "settle" },
  unsettle: { done: "Unsettled", failed: "unsettle" },
  move: { done: "Moved", failed: "move" },
} satisfies Record<BulkAction["type"] | "unpin", { done: string; failed: string }>;

function plural(count: number): string {
  return `${count} ${count === 1 ? "thread" : "threads"}`;
}

export const threadLibraryQuery = convexQuery(api.functions.threads.listThreadLibrary, {});

export function ThreadLibrary() {
  const routeSearch = routeApi.useSearch();
  const navigate = routeApi.useNavigate();
  const { data } = useSuspenseQuery(threadLibraryQuery);
  // A group filter for a group that no longer exists (deleted, or an old bookmark) would hide every
  // thread while the toolbar has no name to show for it, so it falls back to all groups.
  const groupIsKnown =
    routeSearch.group === ALL_GROUPS ||
    routeSearch.group === UNGROUPED ||
    data.groups.some((group) => group._id === routeSearch.group);
  const search = useMemo(
    () => (groupIsKnown ? routeSearch : { ...routeSearch, group: ALL_GROUPS }),
    [groupIsKnown, routeSearch],
  );
  const { data: preferences } = useSuspenseQuery(convexQuery(api.functions.users.getCurrentUserPreferences));

  const pinThread = useThreadPin();
  const updateThreadsInBulk = useMutation(api.functions.threads.updateThreadsInBulk);
  const settleThread = useMutation(api.functions.threads.settleThread);
  const unsettleThread = useMutation(api.functions.threads.unsettleThread);

  const [selected, setSelected] = useState<ReadonlySet<Id<"threads">>>(() => new Set());
  const [dialog, setDialog] = useState<RowDialog>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkPending, startBulk] = useTransition();
  const [now, setNow] = useState(() => Date.now());

  // Keeps relative times ("5 min ago") and the date presets current while the page stays open.
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  // A new filter shows a different set of threads, so a selection made under the old one is dropped.
  const filterKey = JSON.stringify(LIBRARY_FILTER_KEYS.map((key) => search[key]));
  const [previousFilterKey, setPreviousFilterKey] = useState(filterKey);
  if (previousFilterKey !== filterKey) {
    setPreviousFilterKey(filterKey);
    setSelected(new Set());
  }

  const groupTitles = useMemo(() => new Map(data.groups.map((group) => [group._id, group.title])), [data.groups]);
  const groupColors = useMemo(() => getGroupColors(data.groups.map((group) => group._id)), [data.groups]);

  const filtered = useMemo(
    () => data.threads.filter((thread) => matchesFilters(thread, search)),
    [data.threads, search],
  );
  const viewCounts = useMemo(() => getViewCounts(filtered), [filtered]);
  const visible = useMemo(
    () =>
      sortThreads(
        filtered.filter((thread) => matchesView(thread, search.view)),
        search.sort,
        search.dir,
        groupTitles,
      ),
    [filtered, groupTitles, search.dir, search.sort, search.view],
  );
  const page = paginate(visible, search.page, search.size);
  const uncountedCount = useMemo(
    () => data.threads.filter((thread) => thread.messageCount === null).length,
    [data.threads],
  );

  // Threads that were deleted, or moved out of view by an action, drop out of the selection on their own.
  const selectedRows = useMemo(() => visible.filter((thread) => selected.has(thread._id)), [selected, visible]);
  const selectedIds = useMemo(() => new Set(selectedRows.map((thread) => thread._id)), [selectedRows]);

  function updateSearch(patch: Partial<LibrarySearch>) {
    // Anything but a page change reshapes the list, so it starts again from the first page.
    const resetsPage = Object.keys(patch).some((key) => key !== "page");
    void navigate({
      search: (previous) => {
        const next = { ...previous, ...patch };
        if (resetsPage) next.page = 1;
        return next;
      },
      replace: true,
      resetScroll: false,
    });
  }

  function toggleRow(id: Id<"threads">) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePage(checked: boolean) {
    setSelected((previous) => {
      const next = new Set(previous);
      for (const row of page.rows) {
        if (checked) next.add(row._id);
        else next.delete(row._id);
      }
      return next;
    });
  }

  function runBulk(action: BulkAction) {
    const threadIds = selectedRows.map((thread) => thread._id);
    if (threadIds.length === 0) return;

    const verb = BULK_VERBS[action.type === "pin" && !action.pinned ? "unpin" : action.type];
    if (action.type === "pin" && !action.pinned && preferences.confirmations?.unpin) {
      if (!window.confirm(`Unpin ${plural(threadIds.length)}?`)) return;
    }
    if (action.type === "settle" && preferences.confirmations?.settle) {
      if (!window.confirm(`Settle ${plural(threadIds.length)}? Pinned threads are unpinned.`)) return;
    }

    startBulk(async () => {
      let updated = 0;
      let skipped = 0;

      for (let start = 0; start < threadIds.length; start += BULK_CHUNK_SIZE) {
        // oxlint-disable-next-line no-await-in-loop -- Chunks run one after another to stay under the mutation limit.
        const [result, error] = await tryCatch(
          updateThreadsInBulk({ threadIds: threadIds.slice(start, start + BULK_CHUNK_SIZE), action }),
        );
        if (error) {
          // Each chunk commits on its own, so earlier chunks may already have gone through.
          const done = updated > 0 ? ` ${verb.done} ${plural(updated)} before it stopped.` : "";
          toast.error(`Couldn't ${verb.failed} all the selected threads`, {
            description: `${error.message}${done}`,
          });
          return;
        }
        updated += result.updated;
        skipped += result.skipped;
      }

      if (updated === 0) {
        toast.message(`Nothing to change: the selected threads are already that way`);
        return;
      }

      const destination =
        action.type === "move"
          ? ` to ${action.groupId === null ? "Ungrouped" : (groupTitles.get(action.groupId) ?? "the group")}`
          : "";
      toast.success(`${verb.done} ${plural(updated)}${destination}`, {
        description: skipped > 0 ? `${plural(skipped)} skipped because the change didn't apply to them.` : undefined,
      });
    });
  }

  function openBulkDelete() {
    if (selectedRows.every(isRunning)) {
      toast.message("The selected threads are still generating", {
        description: "Wait for them to finish, then delete them.",
      });
      return;
    }
    setBulkDeleteOpen(true);
  }

  const actions: ThreadRowActions = {
    rename: (thread) => setDialog({ type: "rename", thread }),
    share: (thread) => setDialog({ type: "share", thread }),
    remove: (thread) => setDialog({ type: "delete", thread }),
    togglePin: async (thread) => {
      const [, error] = await tryCatch(pinThread({ threadId: thread._id, pinned: !thread.pinned }));
      if (error) toast.error("Couldn't update the pin", { description: error.message });
    },
    toggleSettled: async (thread) => {
      if (!thread.settled) {
        if (!isFinished(thread)) return;
        if (preferences.confirmations?.settle && !window.confirm(`Settle "${thread.title}"?`)) return;
      }
      const mutation = thread.settled ? unsettleThread : settleThread;
      const [, error] = await tryCatch(mutation({ threadId: thread._id }));
      if (error) {
        toast.error(`Couldn't ${thread.settled ? "unsettle" : "settle"} the thread`, { description: error.message });
      }
    },
    move: async (thread, groupId) => {
      const [, error] = await tryCatch(
        updateThreadsInBulk({ threadIds: [thread._id], action: { type: "move", groupId } }),
      );
      if (error) {
        toast.error("Couldn't move the thread", { description: error.message });
        return;
      }
      toast.success(`Moved to ${groupId === null ? "Ungrouped" : (groupTitles.get(groupId) ?? "the group")}`);
    },
    regenerateTitle: (thread) => {
      const promise = regenerateThreadTitle({ threadId: thread._id });
      void toast.promise(promise, {
        loading: "Writing a new title…",
        success: "Title updated",
        error: (error) => (error instanceof Error ? error.message : "Couldn't regenerate the title"),
      });
    },
  };

  const hasFilters = filtered.length !== data.threads.length || search.view !== "all";
  const emptyState =
    data.threads.length === 0 ? (
      <Empty className="border-0 py-14">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MessagesSquareIcon />
          </EmptyMedia>
          <EmptyTitle>No threads yet</EmptyTitle>
          <EmptyDescription>Conversations you start show up here, ready to sort, settle or share.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    ) : (
      <Empty className="border-0 py-14">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchXIcon />
          </EmptyMedia>
          <EmptyTitle>No threads match</EmptyTitle>
          <EmptyDescription>Try a different search, or loosen the filters.</EmptyDescription>
        </EmptyHeader>
        {hasFilters && (
          <EmptyContent>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                updateSearch(Object.fromEntries(LIBRARY_FILTER_KEYS.map((key) => [key, LIBRARY_SEARCH_DEFAULTS[key]])))
              }
            >
              Clear search and filters
            </Button>
          </EmptyContent>
        )}
      </Empty>
    );

  return (
    <div className="@container flex min-w-0 flex-col gap-4">
      <LibraryOverview view={search.view} counts={viewCounts} onViewChange={(view) => updateSearch({ view })} />

      <LibraryToolbar
        search={search}
        groups={data.groups}
        groupColors={groupColors}
        matchCount={visible.length}
        totalCount={data.threads.length}
        uncountedCount={uncountedCount}
        now={now}
        onChange={updateSearch}
      />

      <LibraryTable
        page={page}
        total={visible.length}
        search={search}
        groups={data.groups}
        groupColors={groupColors}
        now={now}
        selected={selectedIds}
        actions={actions}
        emptyState={emptyState}
        onToggleRow={toggleRow}
        onTogglePage={togglePage}
        onSortChange={(sort, dir) => updateSearch({ sort, dir })}
        onPageChange={(nextPage) => updateSearch({ page: nextPage })}
        onPageSizeChange={(size) => updateSearch({ size })}
      />

      <LibraryBulkBar
        selectedCount={selectedRows.length}
        matchCount={visible.length}
        groups={data.groups}
        groupColors={groupColors}
        pending={bulkPending}
        onAction={runBulk}
        onDelete={openBulkDelete}
        onSelectAll={() => setSelected(new Set(visible.map((thread) => thread._id)))}
        onClear={() => setSelected(new Set())}
      />

      {bulkDeleteOpen && (
        <BulkDeleteDialog
          open
          threadIds={selectedRows.filter((thread) => !isRunning(thread)).map((thread) => thread._id)}
          runningCount={selectedRows.filter(isRunning).length}
          onOpenChange={setBulkDeleteOpen}
          onDeleted={() => setSelected(new Set())}
        />
      )}

      {dialog?.type === "rename" && (
        <RenameThreadDialog threadId={dialog.thread._id} title={dialog.thread.title} onClose={() => setDialog(null)} />
      )}
      {dialog?.type === "share" && (
        <ThreadShareDialog
          key={dialog.thread._id}
          threadId={dialog.thread._id}
          threadTitle={dialog.thread.title}
          open
          onOpenChange={(open) => !open && setDialog(null)}
        />
      )}
      {dialog?.type === "delete" && (
        <ThreadDeleteDialog
          threadId={dialog.thread._id}
          title={dialog.thread.title}
          open
          redirectTo=""
          onOpenChange={(open) => !open && setDialog(null)}
        />
      )}
    </div>
  );
}
