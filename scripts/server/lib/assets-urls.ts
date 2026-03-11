import { env } from "../env";

const IMAGE_ASSET_BASE_URL = trimTrailingSlashes(env.PUBLIC_ASSET_BASE_URL);
const RAW_FILE_BASE_URL = trimTrailingSlashes(env.RAW_FILE_BASE_URL);

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

function trimLeadingSlashes(value: string): string {
  return value.replace(/^\/+/, "");
}

function isImageMediaType(mediaType: string): boolean {
  return mediaType.includes("image");
}

export function buildImageAssetUrl(path: string): string {
  return `${IMAGE_ASSET_BASE_URL}/${trimLeadingSlashes(path)}`;
}

export function buildRawFileUrl(path: string): string {
  return `${RAW_FILE_BASE_URL}/${trimLeadingSlashes(path)}`;
}

export function buildAttachmentUrl(path: string, mediaType: string): string {
  if (isImageMediaType(mediaType)) {
    return buildImageAssetUrl(path);
  }

  return buildRawFileUrl(path);
}
