import { createAssetUrlBuilders } from "@ai-chat/shared/assets/urls";

import { env } from "../env";

export const { buildImageAssetUrl, buildRawFileUrl, buildAttachmentUrl } = createAssetUrlBuilders({
  imageAssetBaseUrl: env.PUBLIC_ASSET_BASE_URL,
  rawFileBaseUrl: env.RAW_FILE_BASE_URL,
});
