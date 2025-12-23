import { createResumableStreamContext } from "resumable-stream/ioredis";

import { tryCatch } from "@/lib/utils";
import { env } from "@/env";

import { redisPublisher, redisSubscriber } from "./redis";

export const streamContext = createResumableStreamContext({
  waitUntil: async (task) => void (await tryCatch(task)),
  publisher: redisPublisher,
  subscriber: redisSubscriber,
  keyPrefix: `${env.NODE_ENV}:resumable-stream`,
});