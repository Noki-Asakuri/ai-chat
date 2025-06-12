import type { Thread } from "../types";

export function groupByDate(threads: Thread[]) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const today = new Date(now);

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);

  const groupedThreads = {
    pinned: [],
    today: [],
    yesterday: [],
    sevenDaysAgo: [],
    older: [],
  } as {
    pinned: Thread[];
    today: Thread[];
    yesterday: Thread[];
    sevenDaysAgo: Thread[];
    older: Thread[];
  };

  threads.forEach((thread) => {
    const threadUpdatedAt = new Date(thread.updatedAt);
    threadUpdatedAt.setHours(0, 0, 0, 0);

    if (thread.pinned) {
      groupedThreads.pinned.push(thread);
    } else if (threadUpdatedAt.getTime() === today.getTime()) {
      groupedThreads.today.push(thread);
    } else if (threadUpdatedAt.getTime() === yesterday.getTime()) {
      groupedThreads.yesterday.push(thread);
    } else if (threadUpdatedAt >= sevenDaysAgo && threadUpdatedAt < yesterday) {
      groupedThreads.sevenDaysAgo.push(thread);
    } else {
      groupedThreads.older.push(thread);
    }
  });

  for (const key in groupedThreads) {
    groupedThreads[key as keyof typeof groupedThreads].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  return groupedThreads;
}
