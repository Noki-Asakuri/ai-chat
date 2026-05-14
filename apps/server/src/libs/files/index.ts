import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import type { Context } from "hono";
import { Result, TaggedError } from "better-result";

import { logger } from "../axiom";
import { createServerConvexClient } from "../convex";

type UploadFileR2 = { buffer: Uint8Array; threadId: Id<"threads">; mediaType: string };

type UploadSuccess = { attachmentDocId: Id<"attachments">; filePathname: string };

export class CreateAttachmentError extends TaggedError("CreateAttachmentError")<{
  message: string;
  threadId: Id<"threads">;
  mediaType: string;
  fileAttachmentId: string;
  cause: unknown;
}>() {}

export class GenerateAttachmentUploadUrlError extends TaggedError("GenerateAttachmentUploadUrlError")<{
  message: string;
  threadId: Id<"threads">;
  mediaType: string;
  fileAttachmentId: string;
  attachmentDocId: Id<"attachments">;
  cause: unknown;
}>() {}

export class UploadFileToR2RequestError extends TaggedError("UploadFileToR2RequestError")<{
  message: string;
  threadId: Id<"threads">;
  mediaType: string;
  fileAttachmentId: string;
  attachmentDocId: Id<"attachments">;
  filePathname: string;
  cause: unknown;
}>() {}

export class UploadFileToR2ResponseError extends TaggedError("UploadFileToR2ResponseError")<{
  message: string;
  threadId: Id<"threads">;
  mediaType: string;
  fileAttachmentId: string;
  attachmentDocId: Id<"attachments">;
  filePathname: string;
  status: number;
  statusText: string;
  responseBody: string;
}>() {}

export class SyncAttachmentMetadataError extends TaggedError("SyncAttachmentMetadataError")<{
  message: string;
  threadId: Id<"threads">;
  mediaType: string;
  fileAttachmentId: string;
  attachmentDocId: Id<"attachments">;
  filePathname: string;
  cause: unknown;
}>() {}

export type UploadErrors =
  | CreateAttachmentError
  | GenerateAttachmentUploadUrlError
  | UploadFileToR2RequestError
  | UploadFileToR2ResponseError
  | SyncAttachmentMetadataError;

export async function serverUploadFileR2(
  ctx: Context,
  data: UploadFileR2,
): Promise<Result<UploadSuccess, UploadErrors>> {
  logger.info("[Chat] Uploading file to R2", { threadId: data.threadId, mediaType: data.mediaType });

  const fileAttachmentId = crypto.randomUUID();
  const convexClient = await createServerConvexClient(ctx);

  const attachmentResult = await Result.tryPromise({
    try: () =>
      convexClient.mutation(api.functions.attachments.createAttachment, {
        id: fileAttachmentId,
        name: `${fileAttachmentId}.${data.mediaType}`,

        threadId: data.threadId,
        size: data.buffer.length,
        mimeType: data.mediaType,

        type: "image",
        source: "assistant",
      }),
    catch: (cause) =>
      new CreateAttachmentError({
        message: "Failed to create attachment document for file upload.",
        threadId: data.threadId,
        mediaType: data.mediaType,
        fileAttachmentId,
        cause,
      }),
  });

  if (attachmentResult.isErr()) return Result.err(attachmentResult.error);

  const { docId } = attachmentResult.value;

  logger.info("[Chat] Attachment created", {
    fileAttachmentId,
    threadId: data.threadId,
    type: data.mediaType,
  });

  const uploadUrlResult = await Result.tryPromise({
    try: () =>
      convexClient.mutation(api.functions.files.generateAttachmentUploadUrl, {
        fileId: fileAttachmentId,
        threadId: data.threadId,
        mimeType: data.mediaType,
      }),
    catch: (cause) =>
      new GenerateAttachmentUploadUrlError({
        message: "Failed to generate attachment upload URL.",
        threadId: data.threadId,
        mediaType: data.mediaType,
        fileAttachmentId,
        attachmentDocId: docId,
        cause,
      }),
  });

  if (uploadUrlResult.isErr()) return Result.err(uploadUrlResult.error);

  const { key, url } = uploadUrlResult.value;
  const response = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": data.mediaType },
    body: data.buffer,
  });

  if (!response.ok) {
    const errorText = await response.text();
    const message = `Failed to upload image: ${response.status} ${response.statusText} - ${errorText}`;

    logger.error("[Chat Error]: Upload failed!", { docId, threadId: data.threadId, error: message });

    return Result.err(
      new UploadFileToR2ResponseError({
        message,
        threadId: data.threadId,
        mediaType: data.mediaType,
        fileAttachmentId,
        attachmentDocId: docId,
        filePathname: key,
        status: response.status,
        statusText: response.statusText,
        responseBody: errorText,
      }),
    );
  }

  await Result.tryPromise(async () => convexClient.mutation(api.functions.files.syncMetadata, { key }), {
    retry: { times: 5, backoff: "linear", delayMs: 5000 },
  });

  logger.info("[Chat] File uploaded to R2", { docId, threadId: data.threadId });
  return Result.ok({ attachmentDocId: docId, filePathname: key });
}
