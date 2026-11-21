import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { z } from "zod";

const GroupIdSchema = z.string().pipe(z.custom<Id<"groups">>());

// Builds a typed Convex group id for test fixtures without a type assertion.
export function testGroupId(id: string): Id<"groups"> {
  return GroupIdSchema.parse(id);
}

export type NavigateCall = {
  to: string;
  params?: Record<string, string>;
  search?: Record<string, string | undefined>;
};
