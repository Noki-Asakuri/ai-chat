import { ThreadItem } from "./thread-items";

import type { Thread } from "@/lib/types";

export function ThreadGroup({ title, threads }: { title: string; threads: Thread[] }) {
  if (!threads.length) return null;

  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-primary px-2 text-sm font-semibold">{title}</h4>

      {threads.map((thread) => (
        <ThreadItem key={thread._id} thread={thread} />
      ))}
    </div>
  );
}
