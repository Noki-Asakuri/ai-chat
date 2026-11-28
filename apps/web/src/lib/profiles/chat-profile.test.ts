import { describe, expect, mock, test } from "bun:test";

import { getNewChatInitialProfile, resolveMessageProfile } from "./chat-profile";
import type { ProfileLibrary } from "./profile-library";

import { testGroupId, testProfileId } from "@/test/fixtures";

const reviewer = testProfileId("profile-reviewer");
const writer = testProfileId("profile-writer");
const coding = testGroupId("group-coding");
const writing = testGroupId("group-writing");

const library = {
  profiles: [],
  groups: [
    { _id: coding, title: "Coding", profileId: reviewer },
    { _id: writing, title: "Writing", profileId: writer },
  ],
  ungroupedProfileId: null,
} satisfies ProfileLibrary;

describe("getNewChatInitialProfile", () => {
  test("starts with the group's default", () => {
    expect(getNewChatInitialProfile({ library, groupId: coding, newChatKey: 3, remembered: null })).toEqual({
      profile: reviewer,
      chosen: false,
    });
  });

  test("brings back a hand pick for the same new chat and group, even before profiles load", () => {
    const remembered = { newChatKey: 3, groupId: coding, profileId: null };
    expect(getNewChatInitialProfile({ library: undefined, groupId: coding, newChatKey: 3, remembered })).toEqual({
      profile: null,
      chosen: true,
    });
  });

  test("forgets a hand pick from another new chat or another group", () => {
    const remembered = { newChatKey: 3, groupId: coding, profileId: writer };
    expect(getNewChatInitialProfile({ library, groupId: coding, newChatKey: 4, remembered })?.profile).toBe(reviewer);
    expect(getNewChatInitialProfile({ library, groupId: writing, newChatKey: 3, remembered })).toEqual({
      profile: writer,
      chosen: false,
    });
  });

  test("is unknown while profiles are loading and nothing was picked", () => {
    expect(getNewChatInitialProfile({ library: undefined, groupId: coding, newChatKey: 1, remembered: null })).toBeUndefined();
  });
});

function failToLoad(): Promise<ProfileLibrary> {
  return Promise.reject(new Error("offline"));
}

describe("resolveMessageProfile", () => {
  const base = {
    messageProfileId: null,
    currentProfileId: null,
    chosen: false,
    needsGroupDefault: true,
    groupId: coding,
  };

  test("a profile named in the message or picked by hand wins without loading profiles", async () => {
    const loadLibrary = mock(async () => library);
    expect(await resolveMessageProfile({ ...base, messageProfileId: writer, loadLibrary })).toBe(writer);
    expect(await resolveMessageProfile({ ...base, chosen: true, currentProfileId: null, loadLibrary })).toBeNull();
    expect(loadLibrary).not.toHaveBeenCalled();
  });

  test("a new chat or a thread with no saved profile uses its group's current default", async () => {
    expect(await resolveMessageProfile({ ...base, loadLibrary: async () => library })).toBe(reviewer);
  });

  test("a thread that saved a profile keeps it", async () => {
    const loadLibrary = mock(async () => library);
    expect(
      await resolveMessageProfile({ ...base, needsGroupDefault: false, currentProfileId: writer, loadLibrary }),
    ).toBe(writer);
    expect(loadLibrary).not.toHaveBeenCalled();
  });

  test("fails instead of sending with no profile when the defaults can't be loaded", async () => {
    const error = await resolveMessageProfile({ ...base, loadLibrary: failToLoad }).then(
      () => null,
      (reason: Error) => reason,
    );
    expect(error?.message).toBe("offline");
  });
});
