import { Redis } from "ioredis";

import { env } from "@/env";

type RedisClients = {
  cacheRedis: Redis;
  redisSubscriber: Redis;
  redisPublisher: Redis;
};

export function createRedisClients(): RedisClients {
  const cacheRedis = new Redis(env.REDIS_URL);
  const redisSubscriber = cacheRedis.duplicate();
  const redisPublisher = cacheRedis;

  return { cacheRedis, redisSubscriber, redisPublisher };
}

export const { cacheRedis, redisSubscriber, redisPublisher } = createRedisClients();