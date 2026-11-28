import { expect, test } from "bun:test";

import {
  getGroupDefaultProfileId,
  getProfileDefaultPlaces,
  getProfileInitials,
  type ProfileLibrary,
} from "./profile-library";

import { testGroupId, testProfileId } from "@/test/fixtures";

const reviewer = testProfileId("profile-reviewer");
const coach = testProfileId("profile-coach");
const coding = testGroupId("group-coding");
const writing = testGroupId("group-writing");

const library = {
  profiles: [],
  groups: [
    { _id: coding, title: "Coding", profileId: reviewer },
    { _id: writing, title: "Writing", profileId: null },
  ],
  ungroupedProfileId: coach,
} satisfies ProfileLibrary;

test("getGroupDefaultProfileId reads a group's default, Ungrouped's, or none", () => {
  expect(getGroupDefaultProfileId(library, coding)).toBe(reviewer);
  expect(getGroupDefaultProfileId(library, null)).toBe(coach);
  expect(getGroupDefaultProfileId(library, writing)).toBeNull();
  expect(getGroupDefaultProfileId(undefined, coding)).toBeNull();
});

test("getProfileDefaultPlaces lists Ungrouped first, then groups", () => {
  const both = { ...library, ungroupedProfileId: reviewer };
  expect(getProfileDefaultPlaces(both, reviewer)).toEqual([
    { id: "ungrouped", title: "Ungrouped" },
    { id: coding, title: "Coding" },
  ]);
  expect(getProfileDefaultPlaces(library, coach)).toEqual([{ id: "ungrouped", title: "Ungrouped" }]);
});

test("getProfileInitials", () => {
  expect(getProfileInitials("Code reviewer")).toBe("CR");
  expect(getProfileInitials("writer")).toBe("WR");
  expect(getProfileInitials("   ")).toBe("?");
});
