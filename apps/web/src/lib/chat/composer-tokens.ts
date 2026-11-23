import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Doc, Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { fromText, type Token, type TokenInputController } from "@ui-sdk/react/token-input";
import type { ConvexReactClient } from "convex/react";

export const PROFILE_TOKEN_TYPE = "profile";
export const FILE_TOKEN_TYPE = "file";

export type ComposerAttachment = Pick<
  Doc<"attachments">,
  | "_id"
  | "_creationTime"
  | "id"
  | "name"
  | "size"
  | "type"
  | "source"
  | "mimeType"
  | "path"
  | "threadId"
  | "userId"
> & { thread?: { title: string } | null };

export type ParsedComposerInput = {
  text: string;
  profileId: Id<"profiles"> | null;
  profileLabel: string | null;
  attachmentIds: Array<Id<"attachments">>;
};

function isToken(segment: string | Token): segment is Token {
  return segment instanceof Object;
}

function asDocumentId<TableName extends "profiles" | "attachments">(value: string): Id<TableName> {
  // SAFETY: Token values are written only from Convex document ids picked in the composer's menus.
  // Ids that no longer resolve are dropped by the lookups that use them.
  // eslint-disable-next-line typescript/no-unsafe-type-assertion
  return value as Id<TableName>;
}

export function parseComposerInput(input: string): ParsedComposerInput {
  let text = "";
  let profileId: Id<"profiles"> | null = null;
  let profileLabel: string | null = null;
  const attachmentIds: Array<Id<"attachments">> = [];

  for (const segment of fromText(input)) {
    if (!isToken(segment)) {
      text += segment;
      continue;
    }

    if (segment.type === PROFILE_TOKEN_TYPE) {
      profileId = asDocumentId<"profiles">(segment.value);
      profileLabel = segment.label;
      continue;
    }

    if (segment.type === FILE_TOKEN_TYPE) {
      const attachmentId = asDocumentId<"attachments">(segment.value);
      if (!attachmentIds.includes(attachmentId)) attachmentIds.push(attachmentId);
    }

    text += segment.label;
  }

  return { text: text.trim(), profileId, profileLabel, attachmentIds };
}

const attachmentCache = new Map<Id<"attachments">, ComposerAttachment>();

export function rememberComposerAttachments(attachments: ReadonlyArray<ComposerAttachment>): void {
  for (const attachment of attachments) attachmentCache.set(attachment._id, attachment);
}

export function getCachedComposerAttachment(id: string): ComposerAttachment | undefined {
  return attachmentCache.get(asDocumentId<"attachments">(id));
}

export async function resolveComposerAttachments(
  convexClient: ConvexReactClient,
  ids: ReadonlyArray<Id<"attachments">>,
): Promise<ComposerAttachment[]> {
  if (ids.some((id) => !attachmentCache.has(id))) {
    rememberComposerAttachments(await convexClient.query(api.functions.attachments.getAllAttachments, {}));
  }

  return ids.flatMap((id) => {
    const attachment = attachmentCache.get(id);
    return attachment ? [attachment] : [];
  });
}

const composerControllers = new Map<string, TokenInputController>();

export function registerComposerController(id: string, controller: TokenInputController): () => void {
  composerControllers.set(id, controller);

  return () => {
    if (composerControllers.get(id) === controller) composerControllers.delete(id);
  };
}

export function getComposerController(id: string): TokenInputController | undefined {
  return composerControllers.get(id);
}
