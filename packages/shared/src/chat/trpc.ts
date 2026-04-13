import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";
import { z } from "zod/v4";

import { chatModelParamsSchema } from "./request";

export const syncThreadModelConfigInputSchema = z.object({
  threadId: z.string().optional(),
  model: z.string(),
  modelParams: chatModelParamsSchema,
});

export const regenerateThreadTitleInputSchema = z.object({
  threadId: z.string(),
});

export type SyncThreadModelConfigInput = {
  threadId?: Id<"threads">;
  model: string;
  modelParams: {
    webSearch: boolean;
    effort: "none" | "minimal" | "low" | "medium" | "high" | "xhigh";
    profile?: Id<"profiles"> | null;
  };
};

export type RegenerateThreadTitleInput = {
  threadId: Id<"threads">;
};
