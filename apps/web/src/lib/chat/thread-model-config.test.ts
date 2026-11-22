import { describe, expect, test } from "bun:test";

import { mergeThreadModelConfig } from "@ai-chat/shared/chat/thread-model-config";

const current = {
  model: "openai/gpt-5.6-sol",
  params: { effort: "max" as const, webSearch: false, profile: "profile-1" },
};

describe("mergeThreadModelConfig", () => {
  test("changes only the given params", () => {
    expect(mergeThreadModelConfig(current, { params: { webSearch: true } })).toEqual({
      model: "openai/gpt-5.6-sol",
      params: { effort: "max", webSearch: true, profile: "profile-1" },
    });
  });

  test("clears the profile with null and keeps it when omitted", () => {
    expect(mergeThreadModelConfig(current, { params: { profile: null } }).params.profile).toBeNull();
    expect(mergeThreadModelConfig(current, { params: { effort: "low" } }).params.profile).toBe("profile-1");
  });

  test("keeps the effort on a model change when the new model supports it", () => {
    expect(mergeThreadModelConfig(current, { model: "openai/gpt-5.6-terra" }).params.effort).toBe("max");
  });

  test("falls back to the new model's default effort when it does not support the current one", () => {
    expect(mergeThreadModelConfig(current, { model: "openai/gpt-5.5" }).params.effort).toBe("medium");
  });

  test("resolves a requested effort the model does not support", () => {
    const onGpt55 = { ...current, model: "openai/gpt-5.5" };
    expect(mergeThreadModelConfig(onGpt55, { params: { effort: "max" } }).params.effort).toBe("medium");
  });

  test("keeps any effort for an unknown model", () => {
    const unknown = { ...current, model: "test/unknown" };
    expect(mergeThreadModelConfig(unknown, { params: { effort: "low" } }).params.effort).toBe("low");
  });
});
