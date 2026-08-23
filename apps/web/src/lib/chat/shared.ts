import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";
import { z } from "zod/v4";

import { consumeUIMessageStreamResponse } from "./stream-handler";

import { getConvexReactClient } from "../convex/client";
import { uploadFileToR2 } from "../convex/upload-files";
import { messageStoreActions } from "../store/messages-store";
import type { ChatMessage, UIChatMessage, UserAttachment } from "../types";

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

  try {
    const parsedMessage = extractErrorMessageFromBody(trimmedBody);
    if (parsedMessage) return parsedMessage;
  } catch {
    // The response is plain text rather than JSON.
  }

  return trimmedBody;
}

export function convertToUIChatMessages(messages: UIConvertibleMessage[]): UIChatMessage[] {
  return messages.map(
    (message): UIChatMessage => ({
      id: message.messageId,
      role: message.role,
      // SAFETY: Convex validates persisted message parts with AISDKParts, which mirrors UIMessagePart.
      // eslint-disable-next-line typescript/no-unsafe-type-assertion
      parts: message.parts as UIChatMessage["parts"],
      metadata: message.metadata,
    }),
  );
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
