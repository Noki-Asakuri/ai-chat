import { env } from "@/env";

const IMAGE_ASSET_BASE_URL = trimTrailingSlashes(env.VITE_PUBLIC_ASSET_BASE_URL);
const RAW_FILE_BASE_URL = trimTrailingSlashes(env.VITE_RAW_FILE_BASE_URL);

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

export function isImageAssetUrl(url: string): boolean {
  return url === IMAGE_ASSET_BASE_URL || url.startsWith(`${IMAGE_ASSET_BASE_URL}/`);
}

export function buildImageThumbnailUrl(url: string, transform: string): string {
  if (!isImageAssetUrl(url)) {
    return url;
  }

  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${transform}`;
}

export function toRawFileUrl(url: string): string {
  const imageAssetPrefix = `${IMAGE_ASSET_BASE_URL}/`;

  if (url === IMAGE_ASSET_BASE_URL) {
    return RAW_FILE_BASE_URL;
  }

  if (!url.startsWith(imageAssetPrefix)) {
    return url;
  }

  const path = url.slice(imageAssetPrefix.length);
  return `${RAW_FILE_BASE_URL}/${path}`;
}
