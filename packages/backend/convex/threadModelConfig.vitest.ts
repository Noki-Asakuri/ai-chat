/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { DEFAULT_THREAD_MODEL, DEFAULT_USER_PREFERENCES } from "./functions/users";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const USER_ID = "user_thread_model_config_test";

async function setup() {
  const t = convexTest(schema, modules).withIdentity({ subject: USER_ID });
  await t.run(async (ctx) => {
    await ctx.db.insert("users", {
      userId: USER_ID,
      username: null,
      emailAddress: null,
      imageUrl: null,
      preferences: DEFAULT_USER_PREFERENCES,
    });
  });
  return t;
}

async function insertThread(
  t: Awaited<ReturnType<typeof setup>>,
  options: { profile?: Id<"profiles"> | null; model?: string; effort?: "medium" | "high" | "max" } = {},
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("threads", {
      title: "Model config test thread",
      userId: USER_ID,
      updatedAt: Date.now(),
      pinned: false,
      latestModel: options.model ?? "test/model-a",
      latestModelParams: {
        effort: options.effort ?? "medium",
        webSearch: false,
        profile: options.profile ?? null,
      },
      groupId: null,
      status: "complete",
    });
  });
}

async function readConfig(t: Awaited<ReturnType<typeof setup>>, threadId: Id<"threads">) {
  return await t.run(async (ctx) => {
    const thread = await ctx.db.get("threads", threadId);
    return { latestModel: thread?.latestModel, latestModelParams: thread?.latestModelParams };
  });
}

describe("updateThreadModelConfig", () => {
  test("merges a single param into the stored config", async () => {
    const t = await setup();
    const threadId = await insertThread(t);

    await t.mutation(api.functions.threads.updateThreadModelConfig, {
      threadId,
      latestModelParams: { effort: "high" },
    });
    await t.mutation(api.functions.threads.updateThreadModelConfig, {
      threadId,
      latestModelParams: { webSearch: true },
    });

    expect(await readConfig(t, threadId)).toEqual({
      latestModel: "test/model-a",
      latestModelParams: { effort: "high", webSearch: true, profile: null },
    });
  });

  test("changes the model without touching the params", async () => {
    const t = await setup();
    const threadId = await insertThread(t);

    await t.mutation(api.functions.threads.updateThreadModelConfig, {
      threadId,
      latestModel: "test/model-b",
    });

    expect(await readConfig(t, threadId)).toEqual({
      latestModel: "test/model-b",
      latestModelParams: { effort: "medium", webSearch: false, profile: null },
    });
  });

  test("keeps the profile when omitted and clears it when given null", async () => {
    const t = await setup();
    const profileId = await t.run(async (ctx) => {
      return await ctx.db.insert("profiles", {
        userId: USER_ID,
        name: "Test profile",
        systemPrompt: "",
        createdAt: 0,
        updatedAt: 0,
      });
    });
    const threadId = await insertThread(t, { profile: profileId });

    await t.mutation(api.functions.threads.updateThreadModelConfig, {
      threadId,
      latestModelParams: { effort: "low" },
    });
    expect((await readConfig(t, threadId)).latestModelParams?.profile).toBe(profileId);

    await t.mutation(api.functions.threads.updateThreadModelConfig, {
      threadId,
      latestModelParams: { profile: null },
    });
    expect((await readConfig(t, threadId)).latestModelParams).toEqual({
      effort: "low",
      webSearch: false,
      profile: null,
    });
  });

  test("an effort the thread's model does not support is resolved to its default", async () => {
    const t = await setup();
    const threadId = await insertThread(t, { model: "openai/gpt-5.5" });

    await t.mutation(api.functions.threads.updateThreadModelConfig, {
      threadId,
      latestModelParams: { effort: "max" },
    });
    expect((await readConfig(t, threadId)).latestModelParams?.effort).toBe("medium");

    await t.mutation(api.functions.threads.updateThreadModelConfig, {
      threadId,
      latestModelParams: { effort: "high" },
    });
    expect((await readConfig(t, threadId)).latestModelParams?.effort).toBe("high");
  });

  test("a model and effort saved together keep the effort when the model supports it", async () => {
    const t = await setup();
    const threadId = await insertThread(t, { model: "openai/gpt-5.5" });

    await t.mutation(api.functions.threads.updateThreadModelConfig, {
      threadId,
      latestModel: "openai/gpt-5.6-sol",
      latestModelParams: { effort: "max" },
    });

    expect(await readConfig(t, threadId)).toMatchObject({
      latestModel: "openai/gpt-5.6-sol",
      latestModelParams: { effort: "max" },
    });
  });

  test("a model-only change keeps the stored effort when the new model supports it", async () => {
    const t = await setup();
    const threadId = await insertThread(t, { model: "openai/gpt-5.6-sol", effort: "high" });

    await t.mutation(api.functions.threads.updateThreadModelConfig, {
      threadId,
      latestModel: "openai/gpt-5.6-terra",
    });

    expect(await readConfig(t, threadId)).toMatchObject({
      latestModel: "openai/gpt-5.6-terra",
      latestModelParams: { effort: "high" },
    });
  });

  test("a model-only change falls back to the new model's default effort", async () => {
    const t = await setup();
    const threadId = await insertThread(t, { model: "openai/gpt-5.6-sol", effort: "max" });

    await t.mutation(api.functions.threads.updateThreadModelConfig, {
      threadId,
      latestModel: "openai/gpt-5.5",
    });

    expect(await readConfig(t, threadId)).toMatchObject({
      latestModel: "openai/gpt-5.5",
      latestModelParams: { effort: "medium" },
    });
  });

  test("a partial save fills in a thread stored without model config", async () => {
    const t = await setup();
    const threadId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("threads", {
        title: "Pre-backfill thread",
        userId: USER_ID,
        updatedAt: Date.now(),
        pinned: false,
        latestModel: "test/model-a",
        latestModelParams: { effort: "medium", webSearch: false, profile: null },
        groupId: null,
        status: "complete",
      });
      // Schema validation is off, so stored threads can predate these fields.
      await ctx.db.patch(id, { latestModel: undefined, latestModelParams: undefined });
      return id;
    });

    await t.mutation(api.functions.threads.updateThreadModelConfig, {
      threadId,
      latestModelParams: { webSearch: true },
    });

    // The default model has no reasoning options, so its effort resolves to "none".
    expect(await readConfig(t, threadId)).toEqual({
      latestModel: DEFAULT_THREAD_MODEL,
      latestModelParams: { effort: "none", webSearch: true, profile: null },
    });
  });

  test("a partial save recovers a legacy thread's config from its latest assistant message", async () => {
    const t = await setup();
    const threadId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("threads", {
        title: "Pre-backfill thread",
        userId: USER_ID,
        updatedAt: 2,
        pinned: false,
        latestModel: "test/model-a",
        latestModelParams: { effort: "medium", webSearch: false, profile: null },
        groupId: null,
        status: "complete",
      });
      await ctx.db.patch(id, { latestModel: undefined, latestModelParams: undefined });
      await ctx.db.insert("messages", {
        threadId: id,
        userId: USER_ID,
        messageId: crypto.randomUUID(),
        parts: [{ type: "text", text: "answer" }],
        status: "complete",
        role: "assistant",
        attachments: [],
        createdAt: 1,
        updatedAt: 1,
        metadata: {
          model: { request: "openai/gpt-5.5", response: null },
          finishReason: "stop",
          usages: { inputTokens: 0, outputTokens: 0, reasoningTokens: 0 },
          timeToFirstTokenMs: 0,
          durations: { request: 0, reasoning: 0, text: 0 },
          modelParams: { effort: "high", webSearch: false, profile: null },
        },
      });
      return id;
    });

    await t.mutation(api.functions.threads.updateThreadModelConfig, {
      threadId,
      latestModelParams: { webSearch: true },
    });

    expect(await readConfig(t, threadId)).toEqual({
      latestModel: "openai/gpt-5.5",
      latestModelParams: { effort: "high", webSearch: true, profile: null },
    });
  });

  test("recovery keeps a profile that was cleared to null", async () => {
    const t = await setup();
    const profileId = await t.run(async (ctx) => {
      return await ctx.db.insert("profiles", {
        userId: USER_ID,
        name: "Old profile",
        systemPrompt: "",
        createdAt: 0,
        updatedAt: 0,
      });
    });
    const threadId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("threads", {
        title: "Pre-backfill thread",
        userId: USER_ID,
        updatedAt: 2,
        pinned: false,
        latestModel: "test/model-a",
        latestModelParams: { effort: "medium", webSearch: false, profile: null },
        groupId: null,
        status: "complete",
      });
      // The model is missing, but the profile was explicitly cleared.
      await ctx.db.patch(id, { latestModel: undefined });
      await ctx.db.insert("messages", {
        threadId: id,
        userId: USER_ID,
        messageId: crypto.randomUUID(),
        parts: [{ type: "text", text: "answer" }],
        status: "complete",
        role: "assistant",
        attachments: [],
        createdAt: 1,
        updatedAt: 1,
        metadata: {
          model: { request: "openai/gpt-5.5", response: null },
          finishReason: "stop",
          usages: { inputTokens: 0, outputTokens: 0, reasoningTokens: 0 },
          timeToFirstTokenMs: 0,
          durations: { request: 0, reasoning: 0, text: 0 },
          modelParams: { effort: "high", webSearch: false, profile: profileId },
        },
      });
      return id;
    });

    await t.mutation(api.functions.threads.updateThreadModelConfig, {
      threadId,
      latestModelParams: { webSearch: true },
    });

    expect(await readConfig(t, threadId)).toEqual({
      latestModel: "openai/gpt-5.5",
      latestModelParams: { effort: "medium", webSearch: true, profile: null },
    });
  });

  test("sending a message does not overwrite the thread's model config", async () => {
    const t = await setup();
    const threadId = await insertThread(t, { model: "openai/gpt-5.6-sol", effort: "max" });

    // Sent with settings from before a change the sender had not seen yet.
    await t.mutation(api.functions.messages.addMessagesToThread, {
      threadId,
      messages: [
        {
          messageId: crypto.randomUUID(),
          role: "user",
          status: "complete",
          parts: [{ type: "text", text: "question" }],
          attachments: [],
        },
        {
          messageId: crypto.randomUUID(),
          role: "assistant",
          status: "pending",
          parts: [],
          attachments: [],
          metadata: {
            model: { request: "openai/gpt-5.5", response: null },
            finishReason: null,
            usages: { inputTokens: 0, outputTokens: 0, reasoningTokens: 0 },
            timeToFirstTokenMs: 0,
            durations: { request: 0, reasoning: 0, text: 0 },
            modelParams: { effort: "medium", webSearch: true, profile: null },
          },
        },
      ],
    });

    expect(await readConfig(t, threadId)).toEqual({
      latestModel: "openai/gpt-5.6-sol",
      latestModelParams: { effort: "max", webSearch: false, profile: null },
    });
  });

  test("an empty stored model is recovered like a missing one", async () => {
    const t = await setup();
    const threadId = await insertThread(t, { model: "", effort: "high" });

    await t.mutation(api.functions.threads.updateThreadModelConfig, {
      threadId,
      latestModelParams: { webSearch: true },
    });

    // No assistant message recorded a model, so the default model applies; it has no reasoning.
    expect(await readConfig(t, threadId)).toEqual({
      latestModel: DEFAULT_THREAD_MODEL,
      latestModelParams: { effort: "none", webSearch: true, profile: null },
    });
  });

  test("a legacy profile object is stored as its profile ID, and an unknown one as null", async () => {
    const t = await setup();
    const profileId = await t.run(async (ctx) => {
      return await ctx.db.insert("profiles", {
        userId: USER_ID,
        name: "Legacy profile",
        systemPrompt: "",
        createdAt: 0,
        updatedAt: 0,
      });
    });
    const insertLegacyThread = (profile: { id?: Id<"profiles">; name: string }) =>
      t.run(async (ctx) => {
        const id = await ctx.db.insert("threads", {
          title: "Legacy profile thread",
          userId: USER_ID,
          updatedAt: 0,
          pinned: false,
          latestModel: "openai/gpt-5.5",
          latestModelParams: { effort: "medium", webSearch: false, profile: null },
          groupId: null,
          status: "complete",
        });
        // Schema validation is off, so older rows can hold a profile object instead of an ID.
        // @ts-expect-error -- the legacy shape is not in the current schema
        await ctx.db.patch(id, { latestModelParams: { effort: "medium", webSearch: false, profile } });
        return id;
      });
    const withObject = await insertLegacyThread({ id: profileId, name: "Legacy profile" });
    const withUnknown = await insertLegacyThread({ name: "No id" });

    await t.mutation(api.functions.threads.updateThreadModelConfig, {
      threadId: withObject,
      latestModelParams: { webSearch: true },
    });
    await t.mutation(api.functions.threads.updateThreadModelConfig, {
      threadId: withUnknown,
      latestModelParams: { webSearch: true },
    });

    expect((await readConfig(t, withObject)).latestModelParams?.profile).toBe(profileId);
    expect((await readConfig(t, withUnknown)).latestModelParams?.profile).toBeNull();
  });
});
