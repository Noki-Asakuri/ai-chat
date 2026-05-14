import { DownloadError, type Experimental_DownloadFunction } from "ai";

import { env } from "@/env";
import { redis } from ".";
import { logger } from "../axiom";

type InputOptions = Parameters<Experimental_DownloadFunction>[0];
type OutputOptions = Awaited<ReturnType<Experimental_DownloadFunction>>;

export async function handleImagesCaching(options: InputOptions): Promise<OutputOptions> {
  return Promise.all(options.map(({ url }) => url).map(handler));
}

async function handler(url: URL) {
  const normalizedUrl = url.pathname.slice(1).replaceAll("/", ":");
  const cacheKey = `${env.NODE_ENV}:attachment:${normalizedUrl}`;

  const [cachedBuffer, cachedMediaType] = await Promise.all([
    redis.getBuffer(cacheKey),
    redis.get(`${cacheKey}:mediaType`),
  ]);

  if (cachedBuffer && cachedMediaType) {
    logger.info(`[Chat Cache] ${url}`, { url: url.toString(), status: "HIT", cacheKey });
    return { data: cachedBuffer!, mediaType: cachedMediaType! };
  }

  logger.info(`[Chat Cache] ${url}`, { url: url.toString(), status: "MISS", cacheKey });
  const response = await fetch(url);
  if (!response.ok) {
    throw new DownloadError({ url: response.url, statusCode: response.status });
  }

  const arrayBuffer = await response.arrayBuffer();
  const mediaType = response.headers.get("content-type") ?? "application/octet-stream";
  const buffer = Buffer.from(arrayBuffer);

  // Expire after 12h; store raw buffer. Not awaited so it doesn't block the response.
  void saveCacheForUrl(cacheKey, buffer, mediaType);

  return { data: buffer, mediaType };
}

async function saveCacheForUrl(cacheKey: string, buffer: Buffer, mediaType: string) {
  const expireTime = 12 * 60 * 60;

  await Promise.allSettled([
    redis.set(cacheKey, buffer, "EX", expireTime),
    redis.set(`${cacheKey}:mediaType`, mediaType, "EX", expireTime),
  ]);
}
