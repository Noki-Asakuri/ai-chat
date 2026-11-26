import { api } from "@ai-chat/backend/convex/_generated/api";
import { findAttachmentNames, splitMessageTokens } from "@ai-chat/shared/chat/message-content";
import type { Doc, Id } from "@ai-chat/backend/convex/_generated/dataModel";

import {
  fromText,
  type Token,
  type TokenInputController,
  type TokenInputValueChangeDetails,
  toText,
} from "@ui-sdk/react/token-input";
import type { ConvexReactClient } from "convex/react";

import type { UserAttachment } from "../types";

export const PROFILE_TOKEN_TYPE = "profile";
export const FILE_TOKEN_TYPE = "file";
/** A file added to the composer's tray and not uploaded yet; the value is its local id. */
export const UPLOAD_TOKEN_TYPE = "upload";
/**
 * The name of a file that wasn't sent with its message, saved in place of the file's chip. It has no
 * value, the transcript shows it as plain text, and the model reads it as the name.
 */
export const NAME_TOKEN_TYPE = "name";

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

export function isToken(segment: string | Token): segment is Token {
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

/**
 * A saved message's text, ready for the edit box. Names saved in place of a chip go back to plain
 * text. A message saved before file chips gets a chip wherever it names one of its own files.
 */
export function linkAttachmentNames(
  text: string,
  attachments: ReadonlyArray<{ _id: string; name: string }>,
): string {
  if (splitMessageTokens(text).some((segment) => segment.kind === "token")) {
    const value = fromText(text).map((segment) =>
      isToken(segment) && segment.type === NAME_TOKEN_TYPE ? segment.label : segment,
    );
    return toText(joinAdjacentText(value));
  }

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

/**
 * Adds a chip for each new file: after the caret or selection when the composer has focus, so
 * selected text stays, otherwise at the end.
 */
export function insertUploadChips(composerId: string, attachments: ReadonlyArray<UserAttachment>): void {
  const controller = composerControllers.get(composerId);
  if (!controller || attachments.length === 0) return;

  const editor = document.getElementById(composerId);
  const selection = editor?.contains(document.activeElement) ? controller.editor.selection() : null;
  const value: Array<string | Token> = [];

  // A chip is a word of its own, so it needs a space from the text before it.
  const before = selection
    ? controller.editor.textBefore(1)?.text
    : toLabelText(controller.getValue().at(-1));
  if (before && !/\s$/.test(before)) value.push(" ");

  for (const attachment of attachments) {
    value.push({ type: UPLOAD_TOKEN_TYPE, value: attachment.id, label: attachment.file.name }, " ");
  }

  controller.insert(value, { at: selection ? { start: selection.end, end: selection.end } : "end" });
}

function toLabelText(segment: string | Token | undefined): string | undefined {
  return segment !== undefined && isToken(segment) ? segment.label : segment;
}

/** Whether the composer still has a chip of this type pointing at `value`, such as a pasted copy. */
export function hasComposerChip(composerId: string, type: string, value: string): boolean {
  const controller = composerControllers.get(composerId);
  if (!controller) return false;

  return controller
    .getValue()
    .some((segment) => isToken(segment) && segment.type === type && segment.value === value);
}

/**
 * Removes the chips of this type that point at any of `values`, leaving every other chip alone, as
 * one undoable step that counts as removing them on purpose. A chip standing on its own takes a space
 * next to it along, since it was added with one; the caret stays where it was in the text.
 */
export function removeComposerChips(composerId: string, type: string, values: ReadonlyArray<string>): void {
  const controller = composerControllers.get(composerId);
  if (!controller || values.length === 0) return;

  const value = controller.getValue();
  const next: Array<string | Token> = [];
  // Offsets, in the old value, of each removed chip and space. A chip counts as one.
  const removedAt: number[] = [];
  let offset = 0;
  let dropLeadingSpace = false;

  for (const [index, segment] of value.entries()) {
    if (!isToken(segment)) {
      const drop = dropLeadingSpace && segment.startsWith(" ");
      if (drop) removedAt.push(offset);
      // Empty text is left out, so a later chip sees the text truly before it.
      const text = drop ? segment.slice(1) : segment;
      if (text !== "") next.push(text);
      dropLeadingSpace = false;
      offset += segment.length;
      continue;
    }

    dropLeadingSpace = false;
    if (segment.type !== type || !values.includes(segment.value)) {
      next.push(segment);
      offset += 1;
      continue;
    }

    removedAt.push(offset);
    const previous = next.at(-1);
    const following = value[index + 1];
    const textBefore = previous !== undefined && !isToken(previous) ? previous : undefined;
    const textAfter = following !== undefined && !isToken(following) ? following : undefined;
    const standsAlone = previous === undefined || /\s$/.test(textBefore ?? "");

    if (standsAlone && textAfter?.startsWith(" ")) {
      dropLeadingSpace = true;
    } else if (textBefore?.endsWith(" ") && (following === undefined || /^\s/.test(textAfter ?? ""))) {
      next[next.length - 1] = textBefore.slice(0, -1);
      removedAt.push(offset - 1);
    }
    offset += 1;
  }

  if (removedAt.length === 0) return;

  const selection = controller.editor.selection();
  // The remove button's reason, so the composer counts this as removing the chips on purpose.
  if (!controller.setValue(next, { reason: "remove-press" })) return;
  if (!selection) return;

  // `setValue` puts the caret at the end. Inserting nothing at an offset changes nothing and moves the
  // caret there, so it goes back to where it was, less what was removed before it.
  const caret = selection.end - removedAt.filter((at) => at < selection.end).length;
  controller.insert("", { at: { start: caret, end: caret } });
}

/**
 * Whether a change removed chips on purpose: with a chip's remove button, or Backspace or Delete.
 * Cutting, dragging, typing over a selection, undo and redo don't count.
 */
export function isChipDeletion(
  details: Pick<TokenInputValueChangeDetails, "reason" | "inputType" | "removed">,
): boolean {
  if (details.removed.length === 0) return false;
  if (details.reason === "remove-press") return true;

  const inputType = details.inputType ?? "";
  return (
    details.reason === "input-change" &&
    inputType.startsWith("delete") &&
    inputType !== "deleteByCut" &&
    inputType !== "deleteByDrag"
  );
}

/**
 * Rewrites chips for a message that is being sent: an added file's chip points at its saved
 * attachment once uploaded, and any file chip whose file isn't sent with the message becomes a
 * name chip, so the transcript shows the name as typed rather than reading it as markdown.
 */
export function linkSentFileChips(
  text: string,
  attachmentIdByUploadId: ReadonlyMap<string, string>,
  sentAttachmentIds: ReadonlyArray<string>,
): string {
  const sent = new Set(sentAttachmentIds);

  const value = fromText(text).map((segment) => {
    if (!isToken(segment)) return segment;

    if (segment.type === UPLOAD_TOKEN_TYPE) {
      const attachmentId = attachmentIdByUploadId.get(segment.value);
      return attachmentId && sent.has(attachmentId)
        ? { type: FILE_TOKEN_TYPE, value: attachmentId, label: segment.label }
        : toNameToken(segment.label);
    }

    if (segment.type === FILE_TOKEN_TYPE && !sent.has(segment.value)) return toNameToken(segment.label);
    return segment;
  });

  return toText(value);
}

function toNameToken(label: string): Token {
  return { type: NAME_TOKEN_TYPE, value: "", label };
}

/**
 * Joins neighbouring text, so a name that replaced a chip is escaped together with the text around
 * it. Escaped apart, a backslash before the name could turn chip-like text inside it into a chip.
 */
function joinAdjacentText(value: ReadonlyArray<string | Token>): Array<string | Token> {
  const joined: Array<string | Token> = [];

  for (const segment of value) {
    const last = joined.at(-1);
    if (!isToken(segment) && last !== undefined && !isToken(last)) joined[joined.length - 1] = last + segment;
    else joined.push(segment);
  }

  return joined;
}
