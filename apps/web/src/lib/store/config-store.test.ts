import { describe, expect, test } from "bun:test";

import { createConfigStore } from "./config-store";

import { testGroupId, testProfileId } from "@/test/fixtures";

const coder = testProfileId("profile-coder");
const writer = testProfileId("profile-writer");

describe("config store profile", () => {
  test("a server refresh that leaves the profile out keeps the chosen one and the rest it sent", () => {
    const store = createConfigStore({ model: "a/model", modelParams: { effort: "low", webSearch: false } });
    store.getState().chooseProfile(writer);

    store.getState().setServerState({ model: "b/model", modelParams: { effort: "high", webSearch: true } });

    expect(store.getState().model).toBe("b/model");
    expect(store.getState().modelParams).toEqual({ effort: "high", webSearch: true, profile: writer });
  });

  test("a group default fills an untouched chat but not one picked by hand, unless forced", () => {
    const store = createConfigStore({});

    store.getState().applyDefaultProfile(coder);
    expect(store.getState().modelParams.profile).toBe(coder);

    store.getState().chooseProfile(null);
    store.getState().applyDefaultProfile(writer);
    expect(store.getState().modelParams.profile).toBeNull();

    store.getState().applyDefaultProfile(writer, { force: true });
    expect(store.getState().modelParams.profile).toBe(writer);
    expect(store.getState().profileChosen).toBe(false);
  });
});

describe("new chat profile memory", () => {
  test("a group change forgets a hand pick; staying in the same group keeps it", async () => {
    const { threadStoreActions, useThreadStore } = await import("./thread-store");
    const coding = testGroupId("group-coding");
    const other = testGroupId("group-other");

    threadStoreActions.setActiveGroupId(coding);
    threadStoreActions.rememberNewChatProfile(writer);
    threadStoreActions.setActiveGroupId(coding);
    expect(useThreadStore.getState().newChatProfile?.profileId).toBe(writer);

    threadStoreActions.setActiveGroupId(other);
    threadStoreActions.setActiveGroupId(coding);
    expect(useThreadStore.getState().newChatProfile).toBeNull();
  });
});
