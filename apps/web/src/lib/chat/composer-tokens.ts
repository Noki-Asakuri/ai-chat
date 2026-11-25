import { api } from "@ai-chat/backend/convex/_generated/api";
import { findAttachmentNames, splitMessageTokens } from "@ai-chat/shared/chat/message-content";
import type { Doc, Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { fromText, type Token, type TokenInputController, toText } from "@ui-sdk/react/token-input";
import type { ConvexReactClient } from "convex/react";

import type { UserAttachment } from "../types";

export const PROFILE_TOKEN_TYPE = "profile";
export const FILE_TOKEN_TYPE = "file";
/** A file added to the composer's tray and not uploaded yet; the value is its local id. */
export const UPLOAD_TOKEN_TYPE = "upload";

export const MAIN_COMPOSER_ID = "textarea-chat-input";
export const EDIT_COMPOSER_ID = "textarea-user-message-edit";

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
  displayText: string;
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
  const displaySegments: Array<string | Token> = [];

  for (const segment of fromText(input)) {
    if (!isToken(segment) || segment.type !== PROFILE_TOKEN_TYPE) displaySegments.push(segment);

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

  return {
    text: text.trim(),
    displayText: toText(displaySegments).trim(),
    profileId,
    profileLabel,
    attachmentIds,
  };
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

// Code and markdown links stay as typed; only plain text gets chips.
const PROTECTED_MARKDOWN = /(```[\s\S]*?```|`[^`\n]*`|\[[^\]\n]*\]\([^)\n]*\))/;

export function linkAttachmentNames(
  text: string,
  attachments: ReadonlyArray<{ _id: string; name: string }>,
): string {
  if (splitMessageTokens(text).some((segment) => segment.kind === "token")) return text;

  const value: Array<string | Token> = [];

  for (const [index, chunk] of text.split(PROTECTED_MARKDOWN).entries()) {
    if (index % 2 === 1) {
      value.push(chunk);
      continue;
    }

    let lastIndex = 0;
    for (const match of findAttachmentNames(chunk, attachments)) {
      value.push(chunk.slice(lastIndex, match.index), {
        type: FILE_TOKEN_TYPE,
        value: match.id,
        label: match.name,
      });
      lastIndex = match.index + match.name.length;
    }
    value.push(chunk.slice(lastIndex));
  }

  return toText(value.filter((segment) => segment !== ""));
}

/** Adds a chip for each new file, at the caret when the composer has focus, otherwise at the end. */
export function insertUploadChips(composerId: string, attachments: ReadonlyArray<UserAttachment>): void {
  const controller = composerControllers.get(composerId);
  if (!controller || attachments.length === 0) return;

  const editor = document.getElementById(composerId);
  const atCaret = editor !== null && editor.contains(document.activeElement);
  const value: Array<string | Token> = [];

  if (!atCaret) {
    const last = controller.getValue().at(-1);
    if (last !== undefined && (isToken(last) || !/\s$/.test(last))) value.push(" ");
  }

  for (const attachment of attachments) {
    value.push({ type: UPLOAD_TOKEN_TYPE, value: attachment.id, label: attachment.file.name }, " ");
  }

  controller.insert(value, { at: atCaret ? "caret" : "end" });
}

/** Removes the chips of this type that point at any of `values`, leaving every other chip alone. */
export function removeComposerChips(composerId: string, type: string, values: ReadonlyArray<string>): void {
  const controller = composerControllers.get(composerId);
  if (!controller || values.length === 0) return;

  for (const segment of controller.getValue()) {
    if (isToken(segment) && segment.id && segment.type === type && values.includes(segment.value)) {
      controller.removeToken(segment.id);
    }
  }
}

/**
 * Rewrites chips for a message that is being sent: an added file's chip points at its saved
 * attachment once uploaded, and any file chip whose file isn't sent with the message becomes its name.
 */
export function linkSentFileChips(
  text: string,
  attachmentIdByUploadId: ReadonlyMap<string, string>,
  sentAttachmentIds: ReadonlyArray<string>,
): string {
  const sent = new Set(sentAttachmentIds);

  return toText(
    fromText(text).map((segment) => {
      if (!isToken(segment)) return segment;

      if (segment.type === UPLOAD_TOKEN_TYPE) {
        const attachmentId = attachmentIdByUploadId.get(segment.value);
        return attachmentId && sent.has(attachmentId)
          ? { type: FILE_TOKEN_TYPE, value: attachmentId, label: segment.label }
          : segment.label;
      }

      if (segment.type === FILE_TOKEN_TYPE && !sent.has(segment.value)) return segment.label;
      return segment;
    }),
  );
}
