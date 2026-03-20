import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { consumeUIMessageStreamResponse } from "./stream-handler";

import { getConvexReactClient } from "../convex/client";
import { uploadFileToR2 } from "../convex/uploadFiles";
import { messageStoreActions } from "../store/messages-store";
import type { ChatMessage, UIChatMessage, UserAttachment } from "../types";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeError(error: unknown): Error {
  if (error instanceof Error) return error;
  return new Error(String(error));
}

function extractErrorMessageFromParsedBody(body: unknown): string | null {
  if (!isRecord(body)) return null;

  const payloadError = body["error"];
  if (isRecord(payloadError)) {
    const message = payloadError["message"];
    if (typeof message === "string" && message.length > 0) {
      return message;
    }
  }

  const message = body["message"];
  if (typeof message === "string" && message.length > 0) {
    return message;
  }

  return null;
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

type UIConvertibleMessage = Pick<ChatMessage, "messageId" | "role" | "parts" | "metadata">;

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

  const parsed = parseJson(trimmedBody);
  const parsedMessage = extractErrorMessageFromParsedBody(parsed);
  if (parsedMessage) return parsedMessage;

  return trimmedBody;
}

export function convertToUIChatMessages(messages: UIConvertibleMessage[]): UIChatMessage[] {
  return messages.map(
    (message): UIChatMessage => ({
      id: message.messageId,
      role: message.role,
      parts: message.parts as UIChatMessage["parts"],
      metadata: message.metadata,
    }),
  );
}

export async function processStreamResponse(
  response: Response,
  messageId: Id<"messages">,
  threadId: Id<"threads">,
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
          event.message.parts as ChatMessage["parts"],
        );
      }

      if (event.type === "done") {
        messageStoreActions.removeController(threadId);
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

type UploadedAttachment = {
  attachmentId: Id<"attachments">;
  path: string;
  mediaType: string;
};

export function uploadUserAttachment(
  attachments: UserAttachment[],
  threadId: Id<"threads">,
): Promise<UploadedAttachment[]> {
  const uploadPromises: Promise<UploadedAttachment>[] = [];
  const convexClient = getConvexReactClient();

  async function createAttachmentAndUploadToR2(
    attachment: UserAttachment,
  ): Promise<UploadedAttachment> {
    const createAttachmentPromise = convexClient.mutation(
      api.functions.attachments.createAttachment,
      {
        id: attachment.id,
        name: attachment.file.name,
        size: attachment.file.size,
        mimeType: attachment.file.type,
        threadId: threadId,
        source: "user",
        type: attachment.type,
      },
    );

    const uploadFilePromise = uploadFileToR2(attachment.file, { fileId: attachment.id, threadId });

    const [{ docId }, filePath] = await Promise.all([createAttachmentPromise, uploadFilePromise]);
    return { attachmentId: docId, path: filePath, mediaType: attachment.file.type };
  }

  for (const attachment of attachments) {
    uploadPromises.push(createAttachmentAndUploadToR2(attachment));
  }

  return Promise.all(uploadPromises);
}
