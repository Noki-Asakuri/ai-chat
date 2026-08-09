import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import type { Context } from "hono";
import { Result, TaggedError } from "better-result";

import { logger } from "../axiom";
import { createServerConvexClient } from "../convex";

type UploadFileR2 = { buffer: Uint8Array; threadId: Id<"threads">; mediaType: string };

type UploadSuccess = { attachmentDocId: Id<"attachments">; filePathname: string };

type AttachmentType = "image" | "pdf";

const extensionByMediaType: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function createAttachmentMetadata(fileAttachmentId: string, mediaType: string): { name: string; type: AttachmentType } {
  const normalizedMediaType = mediaType.toLowerCase().split(";")[0]?.trim() ?? "";
  const mediaTypeMajor = normalizedMediaType.split("/")[0] ?? "";
  const mediaTypeSubtype = normalizedMediaType.split("/")[1] ?? "";
  const safeSubtype = mediaTypeSubtype.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const extension = extensionByMediaType[normalizedMediaType] ?? (safeSubtype || "bin");
  const type = mediaTypeMajor === "image" ? "image" : "pdf";

  return { name: `${fileAttachmentId}.${extension}`, type };
}

export class CreateAttachmentError extends TaggedError("CreateAttachmentError")<{
  message: string;
  threadId: Id<"threads">;
  mediaType: string;
  fileAttachmentId: string;
  cause: unknown;
}> {}

export class GenerateAttachmentUploadUrlError extends TaggedError("GenerateAttachmentUploadUrlError")<{
  message: string;
  threadId: Id<"threads">;
  mediaType: string;
  fileAttachmentId: string;
  attachmentDocId: Id<"attachments">;
  cause: unknown;
}> {}

export class UploadFileToR2RequestError extends TaggedError("UploadFileToR2RequestError")<{
  message: string;
  threadId: Id<"threads">;
  mediaType: string;
  fileAttachmentId: string;
  attachmentDocId: Id<"attachments">;
  filePathname: string;
  cause: unknown;
}> {}

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
}> {}

export class SyncAttachmentMetadataError extends TaggedError("SyncAttachmentMetadataError")<{
  message: string;
  threadId: Id<"threads">;
  mediaType: string;
  fileAttachmentId: string;
  attachmentDocId: Id<"attachments">;
  filePathname: string;
  cause: unknown;
}> {}

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
  const attachmentMetadata = createAttachmentMetadata(fileAttachmentId, data.mediaType);

  return Result.gen(async function* () {
    const { docId } = yield* Result.await(
      Result.tryPromise({
        try: () =>
          convexClient.mutation(api.functions.attachments.createAttachment, {
            id: fileAttachmentId,
            name: attachmentMetadata.name,

            threadId: data.threadId,
            size: data.buffer.length,
            mimeType: data.mediaType,

            type: attachmentMetadata.type,
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
      }),
    );

    logger.info("[Chat] Attachment created", {
      fileAttachmentId,
      threadId: data.threadId,
      type: data.mediaType,
    });

    const { key, url } = yield* Result.await(
      Result.tryPromise({
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
      }),
    );

    const response = yield* Result.await(
      Result.tryPromise({
        try: () =>
          fetch(url, {
            method: "PUT",
            headers: { "Content-Type": data.mediaType },
            body: data.buffer,
          }),
        catch: (cause) =>
          new UploadFileToR2RequestError({
            message: "Failed to send file upload request to R2.",
            threadId: data.threadId,
            mediaType: data.mediaType,
            fileAttachmentId,
            attachmentDocId: docId,
            filePathname: key,
            cause,
          }),
      }),
    );

    if (!response.ok) {
      const responseBody = yield* Result.await(
        Result.tryPromise({
          try: () => response.text(),
          catch: (cause) =>
            new UploadFileToR2RequestError({
              message: "Failed to read the rejected R2 upload response.",
              threadId: data.threadId,
              mediaType: data.mediaType,
              fileAttachmentId,
              attachmentDocId: docId,
              filePathname: key,
              cause,
            }),
        }),
      );
      const message = `Failed to upload image: ${response.status} ${response.statusText} - ${responseBody}`;

      logger.error("[Chat Error]: Upload failed!", { docId, threadId: data.threadId, error: message });

      yield* new UploadFileToR2ResponseError({
        message,
        threadId: data.threadId,
        mediaType: data.mediaType,
        fileAttachmentId,
        attachmentDocId: docId,
        filePathname: key,
        status: response.status,
        statusText: response.statusText,
        responseBody,
      });
    }

    yield* Result.await(
      Result.tryPromise(
        {
          try: () => convexClient.mutation(api.functions.files.syncMetadata, { key }),
          catch: (cause) =>
            new SyncAttachmentMetadataError({
              message: "Failed to synchronize attachment metadata after uploading to R2.",
              threadId: data.threadId,
              mediaType: data.mediaType,
              fileAttachmentId,
              attachmentDocId: docId,
              filePathname: key,
              cause,
            }),
        },
        { retry: { times: 5, backoff: "linear", delayMs: 5000 } },
      ),
    );

    logger.info("[Chat] File uploaded to R2", { docId, threadId: data.threadId });
    return Result.ok({ attachmentDocId: docId, filePathname: key });
  });
}
