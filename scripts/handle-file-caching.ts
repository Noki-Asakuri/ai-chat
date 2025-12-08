import type { Experimental_DownloadFunction } from "ai";

import { cacheRedis } from "./server";

import { logger } from "@/lib/axiom/logger";
import { tryCatch } from "@/lib/utils";

import { env } from "@/env";

type InputType = Parameters<Experimental_DownloadFunction>[0][number];
type OutputType = Awaited<ReturnType<Experimental_DownloadFunction>>[number];

export async function handleFileCaching({ url }: InputType): Promise<OutputType> {
  const normalizedUrl = url.pathname.slice(1).replace("/", ":");
  const cacheKey = `${env.NODE_ENV}:attachment:${normalizedUrl}`;

  const [cachedBuffer, cachedMediaType] = await Promise.all([
    cacheRedis.getBuffer(cacheKey),
    cacheRedis.get(`${cacheKey}:mediaType`),
  ]);

  const hit = Boolean(cachedBuffer) && Boolean(cachedMediaType);

  logger.info(`[Chat Cache] ${url}`, {
    url: url.toString(),
    status: hit ? "HIT" : "MISS",
    cacheKey,
  });

  if (hit && cachedBuffer && cachedMediaType) {
    return { data: cachedBuffer, mediaType: cachedMediaType };
  }

  const res = await fetch(url);

  const arrayBuffer = await res.arrayBuffer();
  const mediaType = res.headers.get("content-type")!;
  const buffer = Buffer.from(arrayBuffer);

  async function saveCache() {
    const expireTime = 12 * 60 * 60;

    await Promise.allSettled([
      cacheRedis.set(cacheKey, buffer, "EX", expireTime),
      cacheRedis.set(`${cacheKey}:mediaType`, mediaType, "EX", expireTime),
    ]);
  }

  // Expire after 12h; store raw buffer. Not awaited so it doesn't block the response.
  void tryCatch(saveCache());

  return { data: buffer, mediaType };
}
