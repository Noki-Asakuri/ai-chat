import { api } from "@ai-chat/backend/convex/_generated/api";
import { findAttachmentNames } from "@ai-chat/shared/chat/message-content";
import type { Doc, Id } from "@ai-chat/backend/convex/_generated/dataModel";

import {
  fromText,
  toLabel,
  type Token,
  type TokenInputController,
  type TokenInputValueChangeDetails,
  toText,
} from "@ui-sdk/react/token-input";
import type { ConvexReactClient } from "convex/react";

import { tryGetModelData } from "./models";
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
// Past files being looked up, and ones looked up but not found, such as deleted files, so neither
// is looked up again.
const pendingAttachmentIds = new Set<string>();
const missingAttachmentIds = new Set<string>();

// Composers subscribe to the cache, so a chip redraws once its file is known, wherever it was looked up.
let attachmentCacheVersion = 0;
const attachmentCacheListeners = new Set<() => void>();

export function subscribeToComposerAttachments(listener: () => void): () => void {
  attachmentCacheListeners.add(listener);
  return () => attachmentCacheListeners.delete(listener);
}

export function getComposerAttachmentsVersion(): number {
  return attachmentCacheVersion;
}

export function rememberComposerAttachments(attachments: ReadonlyArray<ComposerAttachment>): void {
  let changed = false;
  for (const attachment of attachments) {
    const known = attachmentCache.get(attachment._id);
    if (known?.type !== attachment.type || known.name !== attachment.name) changed = true;
    attachmentCache.set(attachment._id, attachment);
  }
  // A menu page of files already known redraws nothing.
  if (changed) notifyComposerAttachments();
}

function notifyComposerAttachments(): void {
  attachmentCacheVersion += 1;
  for (const listener of attachmentCacheListeners) listener();
}

export function getCachedComposerAttachment(id: string): ComposerAttachment | undefined {
  return attachmentCache.get(asDocumentId<"attachments">(id));
}

/**
 * Whether this model can read a past file a chip points at. A file not looked up yet counts as
 * readable; one looked up and not found, such as a deleted file, doesn't, since it isn't sent.
 */
export function isPastFileReadableBy(modelId: string, attachmentId: string): boolean {
  if (missingAttachmentIds.has(attachmentId)) return false;
  const attachment = getCachedComposerAttachment(attachmentId);
  const inputs = tryGetModelData(modelId)?.modalities.input;
  // Send reads a model without data as taking no files.
  return !attachment || (inputs?.includes(attachment.type) ?? false);
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

/**
 * Looks up the past files these chips point at that aren't known yet, each at most once in the app.
 * Composers redraw through their subscription once it's done.
 */
export async function lookUpComposerChipFiles(convexClient: ConvexReactClient, text: string): Promise<void> {
  const ids = fromText(text).flatMap((segment) =>
    isToken(segment) &&
    segment.type === FILE_TOKEN_TYPE &&
    !getCachedComposerAttachment(segment.value) &&
    !pendingAttachmentIds.has(segment.value) &&
    !missingAttachmentIds.has(segment.value)
      ? [segment.value]
      : [],
  );
  if (ids.length === 0) return;

  for (const id of ids) pendingAttachmentIds.add(id);
  try {
    await resolveComposerAttachments(
      convexClient,
      ids.map((id) => asDocumentId<"attachments">(id)),
    );
    const missing = ids.filter((id) => !getCachedComposerAttachment(id));
    for (const id of missing) missingAttachmentIds.add(id);
    // Chips of files not found redraw as names.
    if (missing.length > 0) notifyComposerAttachments();
  } finally {
    for (const id of ids) pendingAttachmentIds.delete(id);
  }
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
 * A saved message's text, ready for the edit box. Its chips, name chips too, stay as they are, so
 * saving it unchanged saves the same text. A message saved before file chips gets a chip wherever it
 * names one of its own files.
 */
export function linkAttachmentNames(
  text: string,
  attachments: ReadonlyArray<{ _id: string; name: string }>,
): string {
  const parsed = fromText(text);
  if (parsed.some(isToken)) return text;

  // Work on the text as typed, and escape it once at the end, so text the codec escaped comes back
  // the same rather than gaining a backslash.
  const typed = toLabel(parsed);
  const value: Array<string | Token> = [];

  for (const [index, chunk] of typed.split(PROTECTED_MARKDOWN).entries()) {
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

  return toText(joinAdjacentText(value.filter((segment) => segment !== "")));
}

/** Joins neighbouring text, which `toText` would otherwise escape piece by piece. */
function joinAdjacentText(value: ReadonlyArray<string | Token>): Array<string | Token> {
  const joined: Array<string | Token> = [];

  for (const segment of value) {
    const last = joined.at(-1);
    if (!isToken(segment) && last !== undefined && !isToken(last)) joined[joined.length - 1] = last + segment;
    else joined.push(segment);
  }

  return joined;
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
  // And a space from the text after it, unless that already starts with one.
  if (selection && /^\s/.test(textAt(controller.getValue(), selection.end))) value.pop();

  controller.insert(value, { at: selection ? { start: selection.end, end: selection.end } : "end" });
}

/** The text from `offset` on, up to the next chip. A chip counts as one, as in the token input. */
function textAt(value: ReadonlyArray<string | Token>, offset: number): string {
  let start = 0;
  for (const segment of value) {
    const length = isToken(segment) ? 1 : segment.length;
    if (offset < start + length) return isToken(segment) ? "" : segment.slice(offset - start);
    start += length;
  }
  return "";
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
 * one undoable step. A chip standing on its own takes a space next to it along, since it was added
 * with one; the caret stays where it was in the text.
 */
export function removeComposerChips(composerId: string, type: string, values: ReadonlyArray<string>): void {
  if (values.length === 0) return;
  removeChips(composerId, (segment) => segment.type === type && values.includes(segment.value));
}

function removeChips(composerId: string, matches: (token: Token) => boolean): void {
  const controller = composerControllers.get(composerId);
  if (!controller) return;

  const value = controller.getValue();
  const next: Array<string | Token> = [];
  // Offsets, in the old value, of each removed chip and space. A chip counts as one.
  const removedAt: number[] = [];
  let offset = 0;
  // Where, in the old value, the last text kept in `next` ends, less any spaces trimmed from it.
  let lastTextEnd = 0;
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
      // Text emptied by the dropped space isn't kept, so the last kept text still ends where it did.
      if (text !== "") lastTextEnd = offset;
      continue;
    }

    dropLeadingSpace = false;
    if (!matches(segment)) {
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

    // At the end, or before punctuation or a line break, the space before the chip goes instead. Not
    // before a word or another chip, which it keeps apart.
    const endsPhrase =
      following === undefined || (textAfter !== undefined && !/^[\p{L}\p{N}]/u.test(textAfter));

    if (standsAlone && textAfter?.startsWith(" ")) {
      dropLeadingSpace = true;
    } else if (textBefore?.endsWith(" ") && endsPhrase) {
      lastTextEnd -= 1;
      removedAt.push(lastTextEnd);
      const trimmed = textBefore.slice(0, -1);
      if (trimmed === "") next.pop();
      else next[next.length - 1] = trimmed;
    }
    offset += 1;
  }

  if (removedAt.length === 0) return;

  const selection = controller.editor.selection();
  if (!controller.setValue(next)) return;
  if (!selection) return;

  // `setValue` puts the caret at the end. Inserting nothing at an offset changes nothing and moves the
  // caret there, so it goes back to where it was, less what was removed before it.
  const caret = selection.end - removedAt.filter((at) => at < selection.end).length;
  controller.insert("", { at: { start: caret, end: caret } });
}

/**
 * Turns the chips of these files into name chips, all as one undoable step, so a sentence keeps its
 * words when the files can't go. The caret stays where it was. With no typed words around them, the
 * chips are removed instead, so their names aren't sent as text of their own.
 */
export function nameComposerChips(
  composerId: string,
  files: ReadonlyArray<Pick<Token, "type" | "value">>,
): void {
  const controller = composerControllers.get(composerId);
  if (!controller || files.length === 0) return;

  const matches = (segment: string | Token): segment is Token =>
    isToken(segment) && files.some((file) => file.type === segment.type && file.value === segment.value);
  const value = controller.getValue();
  if (!value.some(matches)) return;

  if (value.every((segment) => isToken(segment) || segment.trim() === "")) {
    removeChips(composerId, matches);
    return;
  }

  const selection = controller.editor.selection();
  const next = value.map((segment) => (matches(segment) ? toNameToken(segment.label) : segment));
  if (!controller.setValue(next) || !selection) return;

  // A chip and a name chip are the same length, so the caret's offset still holds.
  controller.insert("", { at: { start: selection.end, end: selection.end } });
}

/**
 * Whether a change removed a chip on purpose: with its remove button, or a delete key (Backspace,
 * Delete, or a word delete) taking out that one chip and nothing else. `removedLength` is how much
 * shorter the value got, a chip counting as one. Clearing text that holds a chip, cutting, dragging,
 * typing over a selection, undo and redo don't count, so their files stay in the tray.
 */
export function isChipDeletion(
  details: Pick<TokenInputValueChangeDetails, "reason" | "inputType" | "removed">,
  removedLength: number,
): boolean {
  if (details.removed.length === 0) return false;
  if (details.reason === "remove-press") return true;

  const inputType = details.inputType ?? "";
  return (
    details.reason === "input-change" &&
    details.removed.length === 1 &&
    removedLength === 1 &&
    inputType.startsWith("delete") &&
    inputType !== "deleteByCut" &&
    inputType !== "deleteByDrag"
  );
}

/** A value's length as the token input counts it: a chip is one. */
export function composerValueLength(value: ReadonlyArray<string | Token>): number {
  let length = 0;
  for (const segment of value) length += isToken(segment) ? 1 : segment.length;
  return length;
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

/**
 * A draft restored without its tray: the chips of files that were added to it become name chips,
 * since those files are gone.
 */
export function withoutUploadChips(text: string): string {
  const value = fromText(text);
  if (!value.some((segment) => isToken(segment) && segment.type === UPLOAD_TOKEN_TYPE)) return text;

  return toText(
    value.map((segment) =>
      isToken(segment) && segment.type === UPLOAD_TOKEN_TYPE ? toNameToken(segment.label) : segment,
    ),
  );
}

function toNameToken(label: string): Token {
  return { type: NAME_TOKEN_TYPE, value: "", label };
}
