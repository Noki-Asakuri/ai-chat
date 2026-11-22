/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import type { FunctionArgs } from "convex/server";
import { describe, expect, test } from "vitest";

import { api } from "./_generated/api";
import { DEFAULT_USER_PREFERENCES } from "./functions/users";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
type UpdateArgs = FunctionArgs<typeof api.functions.threads.updateThreadModelConfig>;
const USER_ID = "user_thread_model_config_test";

async function setup() {
  const t = convexTest(schema, modules).withIdentity({ subject: USER_ID });
  const threadId = await t.run(async (ctx) => {
    await ctx.db.insert("users", {
      userId: USER_ID,
      username: null,
      emailAddress: null,
      imageUrl: null,
      preferences: DEFAULT_USER_PREFERENCES,
    });
    return await ctx.db.insert("threads", {
      title: "Model config test thread",
      userId: USER_ID,
      updatedAt: Date.now(),
      pinned: false,
      settled: false,
      latestModel: "openai/gpt-5",
      latestModelParams: { effort: "medium", webSearch: false, profile: null },
      groupId: null,
      status: "complete",
    });
  });
  const readConfig = () =>
    t.run(async (ctx) => {
      const thread = await ctx.db.get("threads", threadId);
      return { model: thread?.latestModel, modelParams: thread?.latestModelParams };
    });
  return { t, threadId, readConfig };
}

describe("updateThreadModelConfig", () => {
  test("each save changes only its own setting, so quick changes all survive", async () => {
    const { t, threadId, readConfig } = await setup();
    const update = (patch: Omit<UpdateArgs, "threadId">) =>
      t.mutation(api.functions.threads.updateThreadModelConfig, { threadId, ...patch });

    await update({ effort: "high" });
    await update({ webSearch: true });

    expect(await readConfig()).toEqual({
      model: "openai/gpt-5",
      modelParams: { effort: "high", webSearch: true, profile: null },
    });
  });

  test("a model change keeps a supported effort and resolves an unsupported one", async () => {
    const { t, threadId, readConfig } = await setup();

    await t.mutation(api.functions.threads.updateThreadModelConfig, { threadId, effort: "low" });
    await t.mutation(api.functions.threads.updateThreadModelConfig, { threadId, model: "openai/o3" });
    expect((await readConfig()).modelParams?.effort).toBe("low");

    // Kimi K2.6 offers only "none" and "medium", so "low" falls back to its default.
    await t.mutation(api.functions.threads.updateThreadModelConfig, { threadId, model: "kimi/kimi-k2.6" });
    expect(await readConfig()).toEqual({
      model: "kimi/kimi-k2.6",
      modelParams: { effort: "medium", webSearch: false, profile: null },
    });
  });

  test("clears the profile with null", async () => {
    const { t, threadId, readConfig } = await setup();
    const profileId = await t.run(async (ctx) =>
      ctx.db.insert("profiles", {
        userId: USER_ID,
        name: "Writer",
        systemPrompt: "",
        createdAt: 0,
        updatedAt: 0,
      }),
    );

    await t.mutation(api.functions.threads.updateThreadModelConfig, { threadId, profile: profileId });
    expect((await readConfig()).modelParams?.profile).toBe(profileId);

    await t.mutation(api.functions.threads.updateThreadModelConfig, { threadId, profile: null });
    expect((await readConfig()).modelParams?.profile).toBeNull();
  });

  test("rejects another user's thread", async () => {
    const { t, threadId } = await setup();
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        userId: "someone_else",
        username: null,
        emailAddress: null,
        imageUrl: null,
        preferences: DEFAULT_USER_PREFERENCES,
      });
    });

    await expect(
      t
        .withIdentity({ subject: "someone_else" })
        .mutation(api.functions.threads.updateThreadModelConfig, { threadId, effort: "high" }),
    ).rejects.toThrow("Not authorized");
  });
});

describe("addMessagesToThread", () => {
  test("sending doesn't overwrite the thread's saved settings", async () => {
    const { t, threadId, readConfig } = await setup();
    await t.mutation(api.functions.threads.updateThreadModelConfig, {
      threadId,
      effort: "high",
      webSearch: true,
    });

    // A send carrying older settings, for example one that was in flight while the user changed them.
    await t.mutation(api.functions.messages.addMessagesToThread, {
      threadId,
      messages: [
        {
          messageId: crypto.randomUUID(),
          role: "user",
          status: "complete",
          parts: [{ type: "text", text: "Hello", state: "done" }],
          attachments: [],
        },
        {
          messageId: crypto.randomUUID(),
          role: "assistant",
          status: "pending",
          parts: [],
          attachments: [],
          metadata: {
            model: { request: "openai/o3", response: null },
            finishReason: null,
            timeToFirstTokenMs: 0,
            usages: { inputTokens: 0, outputTokens: 0, reasoningTokens: 0 },
            durations: { request: 0, reasoning: 0, text: 0 },
            modelParams: { effort: "low", webSearch: false, profile: null },
          },
        },
      ],
    });

    expect(await readConfig()).toEqual({
      model: "openai/gpt-5",
      modelParams: { effort: "high", webSearch: true, profile: null },
    });
  });
});
