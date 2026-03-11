import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { z } from "zod/v4";
import {
  createChatRequestValidator,
  type ChatRequestBody,
  type DeprecatedModelErrorDetails,
} from "@ai-chat/shared/chat/validate-request-body";

export type { DeprecatedModelErrorDetails, ChatRequestBody };

export const threadIdSchema = z.custom<Id<"threads">>((data) => z.string().parse(data));
export const messageIdSchema = z.custom<Id<"messages">>((data) => z.string().parse(data));
export const attachmentIdSchema = z.custom<Id<"attachments">>((data) => z.string().parse(data));
export const profileIdSchema = z.custom<Id<"profiles">>((data) => z.string().parse(data));

const validator = createChatRequestValidator({
  assistantMessageIdSchema: messageIdSchema,
  threadIdSchema,
  profileIdSchema,
});

export const inputSchema = validator.inputSchema;

export async function validateRequestBody(body: Record<string, unknown>) {
  return validator.validateRequestBody(body);
}
