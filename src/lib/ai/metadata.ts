import { z } from "zod";

export const chatMetadata = z.object({
  createdAt: z.number().optional(),
  duration: z.number().optional(),
  model: z.string().optional(),
  totalTokens: z.number().optional(),
  finishReason: z.string().optional(),
});

export type ChatMetadata = z.infer<typeof chatMetadata>;
