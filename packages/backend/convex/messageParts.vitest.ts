/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { expect, test } from "vitest";

import { api } from "./_generated/api";
import schema, { CURRENT_MESSAGE_GRAPH_VERSION } from "./schema";

const modules = import.meta.glob("./**/*.ts");
const USER_ID = "user_message_parts_test";

test("returns static tool results with result provider metadata", async () => {
  const t = convexTest(schema, modules).withIdentity({ subject: USER_ID });
  const { threadId, toolPart } = await t.run(async (ctx) => {
    const fixtureThreadId = await ctx.db.insert("threads", {
      title: "Tool result thread",
      userId: USER_ID,
      updatedAt: 1,
      pinned: false,
      settled: false,
      messageGraphVersion: CURRENT_MESSAGE_GRAPH_VERSION,
      latestModel: "test/model",
      latestModelParams: {
        effort: "medium",
        webSearch: true,
        profile: null,
      },
      groupId: null,
      status: "complete",
    });
    const userMessageId = await ctx.db.insert("messages", {
      threadId: fixtureThreadId,
      userId: USER_ID,
      messageId: crypto.randomUUID(),
      parts: [{ type: "text", text: "Search the web" }],
      status: "complete",
      role: "user",
      attachments: [],
      createdAt: 1,
      updatedAt: 1,
    });
    const fixtureToolPart = {
      type: "tool-web_search",
      state: "output-available",
      toolCallId: "call_123",
      input: { query: "example" },
      output: { results: [] },
      callProviderMetadata: { openai: { itemId: "fc_123" } },
      resultProviderMetadata: { openai: { itemId: "fc_123" } },
    } as const;

    await ctx.db.insert("messages", {
      threadId: fixtureThreadId,
      userId: USER_ID,
      messageId: crypto.randomUUID(),
      parts: [fixtureToolPart],
      status: "complete",
      role: "assistant",
      attachments: [],
      parentUserMessageId: userMessageId,
      variantIndex: 0,
      createdAt: 2,
      updatedAt: 2,
    });

    return { threadId: fixtureThreadId, toolPart: fixtureToolPart };
  });

  const page = await t.query(api.functions.messages.getMessagePage, { threadId });

  expect(page.allMessages[1]?.parts).toEqual([toolPart]);
});
