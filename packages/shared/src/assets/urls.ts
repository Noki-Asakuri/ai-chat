type AssetUrlBuildersOptions = {
  /** Base URL for image assets, usually the ImageKit endpoint in front of R2. */
  imageAssetBaseUrl: string;
  /** Base URL for raw file assets, usually the direct/public R2 endpoint. */
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

/**
 * Creates URL helpers for assets that can be served either through the image
 * pipeline or as raw files.
 *
 * The factory trims trailing slashes from the configured base URLs, and every
 * builder trims leading slashes from object paths so callers can pass either
 * `"user/thread/file.png"` or `"/user/thread/file.png"`.
 */
export function createAssetUrlBuilders(options: AssetUrlBuildersOptions) {
  const imageAssetBaseUrl = trimTrailingSlashes(options.imageAssetBaseUrl);
  const rawFileBaseUrl = trimTrailingSlashes(options.rawFileBaseUrl);

  /**
   * Builds a public image asset URL for an object path.
   *
   * Use this for image files that should go through the image asset endpoint,
   * where transforms such as thumbnails can be applied later.
   */
  function buildImageAssetUrl(path: string): string {
    return `${imageAssetBaseUrl}/${trimLeadingSlashes(path)}`;
  }

  /**
   * Builds a public raw file URL for an object path.
   *
   * Use this for files that should be downloaded or displayed without image
   * pipeline transforms, such as PDFs or original file downloads.
   */
  function buildRawFileUrl(path: string): string {
    return `${rawFileBaseUrl}/${trimLeadingSlashes(path)}`;
  }

  /**
   * Builds the correct public URL for an attachment path based on its media type.
   *
   * Image media types are routed through the image asset endpoint. Everything
   * else is routed through the raw file endpoint.
   */
  function buildAttachmentUrl(path: string, mediaType: string): string {
    if (isImageMediaType(mediaType)) {
      return buildImageAssetUrl(path);
    }

    return buildRawFileUrl(path);
  }

  /**
   * Returns whether a URL points at the configured image asset endpoint.
   *
   * This only checks the URL prefix; it does not verify that the remote object
   * exists or that the object is actually an image.
   */
  function isImageAssetUrl(url: string): boolean {
    return url === imageAssetBaseUrl || url.startsWith(`${imageAssetBaseUrl}/`);
  }

  /**
   * Extracts the object path from an image asset URL.
   *
   * Returns `null` when the URL is not under the configured image asset base URL
   * or when it points at the base URL without a path.
   */
  function getImageAssetPathFromUrl(url: string): string | null {
    const imageAssetPrefix = `${imageAssetBaseUrl}/`;

    if (!url.startsWith(imageAssetPrefix)) {
      return null;
    }

    const path = url.slice(imageAssetPrefix.length);
    return path.length > 0 ? path : null;
  }

  /**
   * Adds an image transform query string to an image asset URL.
   *
   * Non-image-asset URLs are returned unchanged. Existing query strings are
   * preserved by appending the transform with `&` instead of `?`.
   */
  function buildImageThumbnailUrl(url: string, transform: string): string {
    if (!isImageAssetUrl(url)) {
      return url;
    }

    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}${transform}`;
  }

  /**
   * Converts an image asset URL back to the corresponding raw file URL.
   *
   * URLs outside the configured image asset endpoint are returned unchanged.
   * This is useful when the UI displays transformed images but needs a direct
   * link to the original object.
   */
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
