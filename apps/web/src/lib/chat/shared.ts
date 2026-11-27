import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Doc, Id } from "@ai-chat/backend/convex/_generated/dataModel";
import { splitMessageTokens, toPlainMessageText } from "@ai-chat/shared/chat/message-content";
import { z } from "zod/v4";

import { consumeUIMessageStreamResponse } from "./stream-handler";

import { buildAttachmentUrl } from "../assets/urls";
import { FILE_TOKEN_TYPE, linkSentFileChips, parseComposerInput } from "./composer-tokens";
import { getConvexReactClient } from "../convex/client";
import { uploadFileToR2 } from "../convex/upload-files";
import { messageStoreActions } from "../store/messages-store";
import type { ChatMessage, UIChatMessage, UserAttachment } from "../types";
import { format } from "../utils";

const errorResponseSchema = z
  .object({
    error: z.object({ message: z.string().optional() }).optional(),
    message: z.string().optional(),
  })
  .loose();

function normalizeError(cause: unknown): Error {
  if (cause instanceof Error) return cause;
  return new Error(String(cause));
}

function extractErrorMessageFromBody(body: string): string | null {
  const result = errorResponseSchema.safeParse(JSON.parse(body));
  if (!result.success) return null;

  const message = result.data.error?.message ?? result.data.message;
  return message && message.length > 0 ? message : null;
}

function getErrorFallbackMessage(status: number): string {
  if (status >= 500) {
    return "The server failed to process the request. Please try again.";
  }

  return `Request failed with status ${status}.`;
}

export class ChatStreamHttpError extends Error {
  readonly status: number;

  constructor(options: { status: number; message: string }) {
    super(options.message);
    this.name = "ChatStreamHttpError";
    this.status = options.status;
  }
}

export type AttachmentDetails = Pick<Doc<"attachments">, "name" | "size" | "mimeType" | "path">;

type UIConvertibleMessage = Pick<ChatMessage, "messageId" | "role" | "parts" | "metadata"> & {
  /** The files sent with the message; each is matched to its file part by URL. */
  attachments: ReadonlyArray<AttachmentDetails>;
};

export async function readResponseErrorMessage(response: Response): Promise<string> {
  const fallback = getErrorFallbackMessage(response.status);

  let bodyText = "";
  try {
    bodyText = await response.text();
  } catch {
    return fallback;
  }

  const trimmedBody = bodyText.trim();
  if (trimmedBody.length === 0) return fallback;

  try {
    const parsedMessage = extractErrorMessageFromBody(trimmedBody);
    if (parsedMessage) return parsedMessage;
  } catch {
    // The response is plain text rather than JSON.
  }

  return trimmedBody;
}

export function convertToUIChatMessages(messages: UIConvertibleMessage[]): UIChatMessage[] {
  return messages.map((message): UIChatMessage => {
    // SAFETY: Convex validates persisted message parts with AISDKParts, which mirrors UIMessagePart.
    // eslint-disable-next-line typescript/no-unsafe-type-assertion
    const parts = message.parts as UIChatMessage["parts"];

    if (message.role !== "user") {
      return { id: message.messageId, role: message.role, parts, metadata: message.metadata };
    }

    // User text is stored with composer chips as `[@label](type:value)`; the model reads the labels.
    const plainParts = parts.flatMap((part): UIChatMessage["parts"] => {
      if (part.type !== "text") return [part];

      // Providers reject empty text blocks, e.g. from a message that was only attachments.
      const text = toPlainMessageText(part.text);
      return text.trim() ? [{ ...part, text }] : [];
    });

    return {
      id: message.messageId,
      role: message.role,
      parts: withFileDetails(plainParts, message.attachments),
      metadata: message.metadata,
    };
  });
}

/** A file a user message is sent with. `uploadId` is its id in the composer's tray, if it was added there. */
export type SentAttachment = AttachmentDetails & { attachmentId: Id<"attachments">; uploadId?: string };

type UserMessageParts = {
  /** What the message is saved with, chips included. */
  displayParts: ChatMessage["parts"];
  /** What the model reads: plain text, a list of the files, and the files. */
  requestParts: UIChatMessage["parts"];
};

/**
 * The parts a user message is saved with, and the parts the model reads for it. Chips of the
 * files sent point at their saved attachments; chips of anything else become plain names.
 */
export function buildUserMessageParts(
  displayText: string,
  attachments: ReadonlyArray<SentAttachment>,
): UserMessageParts {
  const attachmentIdByUploadId = new Map(
    attachments.flatMap((attachment) =>
      attachment.uploadId ? [[attachment.uploadId, attachment.attachmentId] as const] : [],
    ),
  );
  const text = linkSentFileChips(
    displayText,
    attachmentIdByUploadId,
    attachments.map((attachment) => attachment.attachmentId),
  );
  // Text that is only chips of files sent with the message adds nothing to the files themselves.
  const onlySentFiles = splitMessageTokens(text).every((segment) =>
    segment.kind === "token" ? segment.type === FILE_TOKEN_TYPE : segment.text.trim() === "",
  );
  const savedText = onlySentFiles ? "" : text;
  const plainText = onlySentFiles ? "" : parseComposerInput(text).text;
  const fileParts = attachments.map((attachment) => ({
    type: "file" as const,
    url: buildAttachmentUrl(attachment.path, attachment.mimeType),
    mediaType: attachment.mimeType,
    filename: attachment.name,
  }));

  // Providers reject empty text blocks, so a message of only files carries just its files.
  return {
    displayParts: [
      ...(savedText ? [{ type: "text" as const, text: savedText, state: "done" as const }] : []),
      ...fileParts,
    ],
    requestParts: withFileDetails(
      [...(plainText ? [{ type: "text" as const, text: plainText }] : []), ...fileParts],
      attachments,
    ),
  };
}

/**
 * File parts carry only a file's contents, so this names each one and lists every file's name,
 * type and size in a text part placed just before the files.
 */
function urlPath(url: string): string {
  const path = url.split(/[?#]/, 1)[0] ?? url;
  try {
    return decodeURI(path);
  } catch {
    return path;
  }
}

function withFileDetails(
  parts: UIChatMessage["parts"],
  attachments: ReadonlyArray<AttachmentDetails>,
): UIChatMessage["parts"] {
  const attachmentByUrl = new Map(
    attachments.map((attachment) => [buildAttachmentUrl(attachment.path, attachment.mimeType), attachment]),
  );
  // A saved file part keeps the URL it was sent with, so if URLs are built differently later, it
  // still matches its attachment by the path at the URL's end.
  const attachmentFor = (url: string) =>
    attachmentByUrl.get(url) ??
    attachments.find((attachment) => urlPath(url).endsWith(`/${attachment.path}`));
  const described: AttachmentDetails[] = [];

  const named = parts.map((part) => {
    if (part.type !== "file") return part;

    const attachment = attachmentFor(part.url);
    if (!attachment) return part;

    described.push(attachment);
    return { ...part, filename: part.filename ?? attachment.name };
  });

  const description = describeAttachments(described);
  if (!description) return named;

  const firstFileIndex = named.findIndex((part) => part.type === "file");
  return named.toSpliced(firstFileIndex, 0, { type: "text", text: description });
}

const toListText = (text: string): string =>
  text
    .replaceAll(/[\s\p{Cc}\u2028\u2029]+/gu, " ")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .trim();

export function describeAttachments(attachments: ReadonlyArray<AttachmentDetails>): string | null {
  if (attachments.length === 0) return null;

  // A name is one line of plain text, so it can't end the list or start a line of its own.
  const lines = attachments.map(
    (attachment) =>
      `- ${toListText(attachment.name)} (${toListText(attachment.mimeType) || "unknown type"}, ${format.size(attachment.size)})`,
  );
  return `<attached_files>\n${lines.join("\n")}\n</attached_files>`;
}

export async function processStreamResponse(
  response: Response,
  messageId: Id<"messages">,
  threadId: Id<"threads">,
  expectedController?: AbortController,
): Promise<void> {
  if (!response.ok) {
    const errorMessage = await readResponseErrorMessage(response);

    throw new ChatStreamHttpError({
      status: response.status,
      message: errorMessage,
    });
  }

  let streamError: Error | null = null;

  await consumeUIMessageStreamResponse<UIChatMessage>({
    response,
    onEvent(event) {
      if (event.type === "message") {
        messageStoreActions.setMessageParts(
          threadId,
          messageId,
          // SAFETY: UIChatMessage parts and the persisted AISDKParts validator model the same wire format.
          // eslint-disable-next-line typescript/no-unsafe-type-assertion
          event.message.parts as ChatMessage["parts"],
        );
      }

      if (event.type === "done") {
        messageStoreActions.removeController(threadId, expectedController);
      }

      if (event.type === "error" && streamError === null) {
        streamError = normalizeError(event.error);
      }
    },
  });

  if (streamError) {
    throw streamError;
  }
}

type UploadedAttachment = SentAttachment & { uploadId: string };

export function uploadUserAttachment(
  attachments: UserAttachment[],
  threadId: Id<"threads">,
): Promise<UploadedAttachment[]> {
  const uploadPromises: Promise<UploadedAttachment>[] = [];
  const convexClient = getConvexReactClient();

  async function createAttachmentAndUploadToR2(attachment: UserAttachment): Promise<UploadedAttachment> {
    const createAttachmentPromise = convexClient.mutation(api.functions.attachments.createAttachment, {
      id: attachment.id,
      name: attachment.file.name,
      size: attachment.file.size,
      mimeType: attachment.file.type,
      threadId: threadId,
      source: "user",
      type: attachment.type,
    });

    const uploadFilePromise = uploadFileToR2(attachment.file, { fileId: attachment.id, threadId });

    const [{ docId }, filePath] = await Promise.all([createAttachmentPromise, uploadFilePromise]);
    return {
      uploadId: attachment.id,
      attachmentId: docId,
      name: attachment.file.name,
      size: attachment.file.size,
      mimeType: attachment.file.type,
      path: filePath,
    };
  }

  for (const attachment of attachments) {
    uploadPromises.push(createAttachmentAndUploadToR2(attachment));
  }

  return Promise.all(uploadPromises);
}
