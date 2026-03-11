type AssetUrlBuildersOptions = {
  imageAssetBaseUrl: string;
  rawFileBaseUrl: string;
};

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

function trimLeadingSlashes(value: string): string {
  return value.replace(/^\/+/, "");
}

function isImageMediaType(mediaType: string): boolean {
  return mediaType.includes("image");
}

export function createAssetUrlBuilders(options: AssetUrlBuildersOptions) {
  const imageAssetBaseUrl = trimTrailingSlashes(options.imageAssetBaseUrl);
  const rawFileBaseUrl = trimTrailingSlashes(options.rawFileBaseUrl);

  function buildImageAssetUrl(path: string): string {
    return `${imageAssetBaseUrl}/${trimLeadingSlashes(path)}`;
  }

  function buildRawFileUrl(path: string): string {
    return `${rawFileBaseUrl}/${trimLeadingSlashes(path)}`;
  }

  function buildAttachmentUrl(path: string, mediaType: string): string {
    if (isImageMediaType(mediaType)) {
      return buildImageAssetUrl(path);
    }

    return buildRawFileUrl(path);
  }

  function isImageAssetUrl(url: string): boolean {
    return url === imageAssetBaseUrl || url.startsWith(`${imageAssetBaseUrl}/`);
  }

  function getImageAssetPathFromUrl(url: string): string | null {
    const imageAssetPrefix = `${imageAssetBaseUrl}/`;

    if (!url.startsWith(imageAssetPrefix)) {
      return null;
    }

    const path = url.slice(imageAssetPrefix.length);
    return path.length > 0 ? path : null;
  }

  function buildImageThumbnailUrl(url: string, transform: string): string {
    if (!isImageAssetUrl(url)) {
      return url;
    }

    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}${transform}`;
  }

  function toRawFileUrl(url: string): string {
    const imageAssetPrefix = `${imageAssetBaseUrl}/`;

    if (url === imageAssetBaseUrl) {
      return rawFileBaseUrl;
    }

    if (!url.startsWith(imageAssetPrefix)) {
      return url;
    }

    const path = url.slice(imageAssetPrefix.length);
    return `${rawFileBaseUrl}/${path}`;
  }

  return {
    buildImageAssetUrl,
    buildRawFileUrl,
    buildAttachmentUrl,
    isImageAssetUrl,
    getImageAssetPathFromUrl,
    buildImageThumbnailUrl,
    toRawFileUrl,
  };
}
