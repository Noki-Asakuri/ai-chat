import { createAssetUrlBuilders } from "@ai-chat/shared/assets/urls";

import { env } from "@/env";

export const {
  buildImageAssetUrl,
  buildRawFileUrl,
  buildAttachmentUrl,
  isImageAssetUrl,
  getImageAssetPathFromUrl,
  buildImageThumbnailUrl,
  toRawFileUrl,
} = createAssetUrlBuilders({
  imageAssetBaseUrl: env.VITE_PUBLIC_ASSET_BASE_URL,
  rawFileBaseUrl: env.VITE_RAW_FILE_BASE_URL,
});
