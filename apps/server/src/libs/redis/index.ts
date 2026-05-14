import { Redis } from "ioredis";

import { env } from "@/env";

export function createRedisClient(): Redis {
  return new Redis(env.REDIS_URL);
}

export const redis = createRedisClient();
