import type { Thread } from "../types";

type GroupThreadsType = {
  pinned: Thread[];
  today: Thread[];
  yesterday: Thread[];
  sevenDaysAgo: Thread[];
  older: Thread[];
};

export function groupByDate(threads: Thread[]) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const today = new Date(now);

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);

  const groupedThreads: GroupThreadsType = {
    pinned: [],
    today: [],
    yesterday: [],
    sevenDaysAgo: [],
    older: [],
  };

  threads.forEach((thread) => {
    const threadUpdatedAt = new Date(thread.updatedAt);
    threadUpdatedAt.setHours(0, 0, 0, 0);

    switch (true) {
      case thread.pinned:
        groupedThreads.pinned.push(thread);
        break;

      case threadUpdatedAt.getTime() === today.getTime():
        groupedThreads.today.push(thread);
        break;

      case threadUpdatedAt.getTime() === yesterday.getTime():
        groupedThreads.yesterday.push(thread);
        break;

      case threadUpdatedAt >= sevenDaysAgo && threadUpdatedAt < yesterday:
        groupedThreads.sevenDaysAgo.push(thread);
        break;

      default:
        groupedThreads.older.push(thread);
        break;
    }
  });

  for (const key in groupedThreads) {
    groupedThreads[key as keyof GroupThreadsType].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  return groupedThreads;
}
