/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";

import { api } from "./_generated/api";
import { r2 } from "./components";
import type { Id } from "./_generated/dataModel";
import { DEFAULT_USER_PREFERENCES } from "./functions/users";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const USER_ID = "user_profiles_test";
const OTHER_USER_ID = "user_profiles_other";

function setup() {
  return convexTest(schema, modules).withIdentity({ subject: USER_ID });
}

type T = ReturnType<typeof setup>;

async function insertUser(t: T, userId = USER_ID): Promise<void> {
  await t.run(async (ctx) => {
    await ctx.db.insert("users", {
      userId,
      username: null,
      emailAddress: null,
      imageUrl: null,
      preferences: DEFAULT_USER_PREFERENCES,
    });
  });
}

async function insertGroup(t: T, title: string, userId = USER_ID): Promise<Id<"groups">> {
  return await t.run(async (ctx) => ctx.db.insert("groups", { title, userId }));
}

function createProfile(
  t: T,
  name: string,
  defaultFor?: { ungrouped: boolean; groupIds: Array<Id<"groups">> },
) {
  return t.mutation(api.functions.profiles.createProfile, {
    name,
    systemPrompt: `You are ${name}.`,
    defaultChanges: defaultFor && {
      ungrouped: defaultFor.ungrouped,
      addGroupIds: defaultFor.groupIds,
      removeGroupIds: [],
    },
  });
}

function library(t: T) {
  return t.query(api.functions.profiles.getProfileLibrary, {});
}

function defaultOf(lib: Awaited<ReturnType<typeof library>>, groupId: Id<"groups">) {
  return lib.groups.find((group) => group._id === groupId)?.profileId ?? null;
}

describe("profile group defaults", () => {
  test("a profile becomes the default for the groups and Ungrouped it is assigned to", async () => {
    const t = setup();
    await insertUser(t);
    const coding = await insertGroup(t, "Coding");
    const writing = await insertGroup(t, "Writing");

    const reviewer = await createProfile(t, "Reviewer", { ungrouped: true, groupIds: [coding] });

    const lib = await library(t);
    expect(lib.ungroupedProfileId).toBe(reviewer);
    expect(defaultOf(lib, coding)).toBe(reviewer);
    expect(defaultOf(lib, writing)).toBeNull();
  });

  test("assigning a group to another profile takes it over, and unchecking a group gives it up", async () => {
    const t = setup();
    await insertUser(t);
    const coding = await insertGroup(t, "Coding");
    const writing = await insertGroup(t, "Writing");

    const reviewer = await createProfile(t, "Reviewer", { ungrouped: false, groupIds: [coding, writing] });
    const coach = await createProfile(t, "Coach", { ungrouped: false, groupIds: [writing] });

    let lib = await library(t);
    expect(defaultOf(lib, coding)).toBe(reviewer);
    expect(defaultOf(lib, writing)).toBe(coach);

    // The editor still thinks Reviewer holds Writing; unchecking both must not take Writing from Coach.
    await t.mutation(api.functions.profiles.updateProfile, {
      profileId: reviewer,
      defaultChanges: { ungrouped: false, addGroupIds: [], removeGroupIds: [coding, writing] },
    });

    lib = await library(t);
    expect(defaultOf(lib, coding)).toBeNull();
    // Giving up groups it no longer holds must not touch another profile's default.
    expect(defaultOf(lib, writing)).toBe(coach);
  });

  test("leaving defaultChanges out of an update keeps the profile's assignments", async () => {
    const t = setup();
    await insertUser(t);
    const coding = await insertGroup(t, "Coding");
    const reviewer = await createProfile(t, "Reviewer", { ungrouped: true, groupIds: [coding] });

    await t.mutation(api.functions.profiles.updateProfile, { profileId: reviewer, name: "Strict reviewer" });

    const lib = await library(t);
    expect(lib.ungroupedProfileId).toBe(reviewer);
    expect(defaultOf(lib, coding)).toBe(reviewer);
    expect(lib.profiles[0]?.name).toBe("Strict reviewer");
  });

  test("deleting a profile clears every default that pointed at it", async () => {
    const t = setup();
    await insertUser(t);
    const coding = await insertGroup(t, "Coding");
    const reviewer = await createProfile(t, "Reviewer", { ungrouped: true, groupIds: [coding] });

    await t.mutation(api.functions.profiles.deleteProfile, { profileId: reviewer });

    const lib = await library(t);
    expect(lib.profiles).toHaveLength(0);
    expect(lib.ungroupedProfileId).toBeNull();
    expect(defaultOf(lib, coding)).toBeNull();
    const stored = await t.run(async (ctx) => ctx.db.get("groups", coding));
    expect(stored?.profileId).toBeUndefined();
  });

  test("setGroupDefaultProfile sets and clears one group or Ungrouped", async () => {
    const t = setup();
    await insertUser(t);
    const coding = await insertGroup(t, "Coding");
    const reviewer = await createProfile(t, "Reviewer");

    await t.mutation(api.functions.profiles.setGroupDefaultProfile, { groupId: coding, profileId: reviewer });
    await t.mutation(api.functions.profiles.setGroupDefaultProfile, { groupId: null, profileId: reviewer });
    let lib = await library(t);
    expect(defaultOf(lib, coding)).toBe(reviewer);
    expect(lib.ungroupedProfileId).toBe(reviewer);

    await t.mutation(api.functions.profiles.setGroupDefaultProfile, { groupId: coding, profileId: null });
    lib = await library(t);
    expect(defaultOf(lib, coding)).toBeNull();
    expect(lib.ungroupedProfileId).toBe(reviewer);
  });

  test("refuses another person's group", async () => {
    const t = setup();
    await insertUser(t);
    await insertUser(t, OTHER_USER_ID);
    const theirs = await insertGroup(t, "Theirs", OTHER_USER_ID);

    await expect(createProfile(t, "Reviewer", { ungrouped: false, groupIds: [theirs] })).rejects.toThrow(
      "Group not found",
    );
    const reviewer = await createProfile(t, "Reviewer");
    await expect(
      t.mutation(api.functions.profiles.setGroupDefaultProfile, { groupId: theirs, profileId: reviewer }),
    ).rejects.toThrow("Group not found");
  });

  test("rejects a blank name or instruction", async () => {
    const t = setup();
    await insertUser(t);

    await expect(
      t.mutation(api.functions.profiles.createProfile, { name: "  ", systemPrompt: "x" }),
    ).rejects.toThrow("Enter a profile name");
    await expect(
      t.mutation(api.functions.profiles.createProfile, { name: "A", systemPrompt: " \n " }),
    ).rejects.toThrow("Enter a system prompt");
  });
});

function spyOnDelete() {
  return vi.spyOn(r2, "deleteObject").mockResolvedValue(undefined);
}

describe("profile images", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("refuses an image key outside the person's own storage", async () => {
    const t = setup();
    await insertUser(t);
    const deleteObject = spyOnDelete();

    await expect(
      t.mutation(api.functions.profiles.createProfile, {
        name: "A",
        systemPrompt: "x",
        imageKey: `${OTHER_USER_ID}/profiles/theirs`,
      }),
    ).rejects.toThrow("Not authorized to use this image");

    const profileId = await t.mutation(api.functions.profiles.createProfile, {
      name: "A",
      systemPrompt: "x",
      imageKey: `${USER_ID}/profiles/mine`,
    });
    await expect(
      t.mutation(api.functions.profiles.updateProfile, {
        profileId,
        imageKey: `${OTHER_USER_ID}/profiles/theirs`,
      }),
    ).rejects.toThrow("Not authorized to use this image");
    expect(deleteObject).not.toHaveBeenCalled();
  });

  test("replacing or removing an image deletes the old one, and keeping it deletes nothing", async () => {
    const t = setup();
    await insertUser(t);
    const deleteObject = spyOnDelete();
    const first = `${USER_ID}/profiles/first`;
    const second = `${USER_ID}/profiles/second`;

    const profileId = await t.mutation(api.functions.profiles.createProfile, {
      name: "A",
      systemPrompt: "x",
      imageKey: first,
    });

    await t.mutation(api.functions.profiles.updateProfile, { profileId, imageKey: first, name: "B" });
    expect(deleteObject).not.toHaveBeenCalled();

    await t.mutation(api.functions.profiles.updateProfile, { profileId, imageKey: second });
    expect(deleteObject).toHaveBeenCalledTimes(1);
    expect(deleteObject.mock.calls[0]?.[1]).toBe(first);

    await t.mutation(api.functions.profiles.updateProfile, { profileId, imageKey: null });
    expect(deleteObject).toHaveBeenCalledTimes(2);
    expect(deleteObject.mock.calls[1]?.[1]).toBe(second);
    const stored = await t.run(async (ctx) => ctx.db.get("profiles", profileId));
    expect(stored?.imageKey).toBeUndefined();
  });

  test("discardProfileImage deletes only an unused image of the person's own", async () => {
    const t = setup();
    await insertUser(t);
    const deleteObject = spyOnDelete();
    const used = `${USER_ID}/profiles/used`;
    await t.mutation(api.functions.profiles.createProfile, { name: "A", systemPrompt: "x", imageKey: used });

    await t.mutation(api.functions.profiles.discardProfileImage, { imageKey: used });
    expect(deleteObject).not.toHaveBeenCalled();

    await expect(
      t.mutation(api.functions.profiles.discardProfileImage, { imageKey: `${OTHER_USER_ID}/profiles/x` }),
    ).rejects.toThrow("Not authorized to use this image");

    const orphan = `${USER_ID}/profiles/orphan`;
    await t.mutation(api.functions.profiles.discardProfileImage, { imageKey: orphan });
    expect(deleteObject).toHaveBeenCalledTimes(1);
    expect(deleteObject.mock.calls[0]?.[1]).toBe(orphan);
  });

  test("an image another profile still shows is not deleted when one profile gives it up", async () => {
    const t = setup();
    await insertUser(t);
    const deleteObject = spyOnDelete();
    const shared = `${USER_ID}/profiles/shared`;
    const first = await t.mutation(api.functions.profiles.createProfile, {
      name: "A",
      systemPrompt: "x",
      imageKey: shared,
    });
    const second = await t.mutation(api.functions.profiles.createProfile, {
      name: "B",
      systemPrompt: "x",
      imageKey: shared,
    });

    await t.mutation(api.functions.profiles.updateProfile, { profileId: first, imageKey: null });
    expect(deleteObject).not.toHaveBeenCalled();

    await t.mutation(api.functions.profiles.deleteProfile, { profileId: second });
    expect(deleteObject).toHaveBeenCalledTimes(1);
    expect(deleteObject.mock.calls[0]?.[1]).toBe(shared);
  });
});

test("a group deleted while the editor was open is skipped instead of failing the save", async () => {
  const t = setup();
  await insertUser(t);
  const coding = await insertGroup(t, "Coding");
  const gone = await insertGroup(t, "Gone");
  const reviewer = await createProfile(t, "Reviewer");
  await t.run(async (ctx) => ctx.db.delete(gone));

  await t.mutation(api.functions.profiles.updateProfile, {
    profileId: reviewer,
    defaultChanges: { addGroupIds: [coding, gone], removeGroupIds: [] },
  });

  const lib = await library(t);
  expect(lib.groups.find((group) => group._id === coding)?.profileId).toBe(reviewer);
});
