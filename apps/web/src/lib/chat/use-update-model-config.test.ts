import { afterAll, describe, expect, mock, test } from "bun:test";

import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { fromUUID } from "@/lib/utils";

// Only the pure merge is under test; keep the hook's module graph light.
await mock.module("@tanstack/react-router", () => ({ useParams: () => undefined }));
const { nextThreadPageMeta } = await import("./use-update-model-config");

afterAll(() => mock.restore());

const threadId = fromUUID<Id<"threads">>("thread-1");

const meta = {
  title: "Thread",
  groupId: null,
  groupTitle: null,
  pinned: false,
  settled: false,
  isShared: false,
  status: "complete" as const,
  updatedAt: 0,
  lastViewedAt: null,
  latestModel: "openai/gpt-5.6-sol",
  latestModelParams: { effort: "max" as const, webSearch: false, profile: null },
};

describe("nextThreadPageMeta", () => {
  test("merges the update into the thread meta", () => {
    expect(nextThreadPageMeta(meta, { threadId, latestModel: "openai/gpt-5.5" })).toEqual({
      ...meta,
      latestModel: "openai/gpt-5.5",
      latestModelParams: { effort: "medium", webSearch: false, profile: null },
    });
  });

  test("returns null for thread meta without a model config", () => {
    const legacy = { ...meta, latestModelParams: { ...meta.latestModelParams, effort: undefined } };

    // @ts-expect-error -- stored rows from before the backfill can lack fields the type requires
    expect(nextThreadPageMeta(legacy, { threadId, latestModelParams: { webSearch: true } })).toBeNull();
  });
});
