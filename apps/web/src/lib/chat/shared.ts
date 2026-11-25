import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Doc, Id } from "@ai-chat/backend/convex/_generated/dataModel";
import { toPlainMessageText } from "@ai-chat/shared/chat/message-content";
import { z } from "zod/v4";

import { consumeUIMessageStreamResponse } from "./stream-handler";

import { buildAttachmentUrl } from "../assets/urls";
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

export type UIConvertibleMessage = Pick<ChatMessage, "messageId" | "role" | "parts" | "metadata"> & {
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

/**
 * File parts carry only a file's contents, so this names each one and lists every file's name,
 * type and size in a text part placed just before the files.
 */
function withFileDetails(
  parts: UIChatMessage["parts"],
  attachments: ReadonlyArray<AttachmentDetails>,
): UIChatMessage["parts"] {
  const attachmentByUrl = new Map(
    attachments.map((attachment) => [buildAttachmentUrl(attachment.path, attachment.mimeType), attachment]),
  );
  const described: AttachmentDetails[] = [];

  const named = parts.map((part) => {
    if (part.type !== "file") return part;

    const attachment = attachmentByUrl.get(part.url);
    if (!attachment) return part;

    described.push(attachment);
    return { ...part, filename: part.filename ?? attachment.name };
  });

  const description = describeAttachments(described);
  if (!description) return named;

  const firstFileIndex = named.findIndex((part) => part.type === "file");
  return named.toSpliced(firstFileIndex, 0, { type: "text", text: description });
}

export function describeAttachments(attachments: ReadonlyArray<AttachmentDetails>): string | null {
  if (attachments.length === 0) return null;

  const lines = attachments.map(
    (attachment) =>
      `- ${attachment.name} (${attachment.mimeType || "unknown type"}, ${format.size(attachment.size)})`,
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

type UploadedAttachment = AttachmentDetails & {
  /** The id the file had in the composer's tray. */
  id: string;
  attachmentId: Id<"attachments">;
};

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
      id: attachment.id,
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
