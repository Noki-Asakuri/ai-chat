/* oxlint-disable no-await-in-loop -- Stream reads depend on the preceding read result. */
import { Result, TaggedError } from "better-result";
import type { Redis } from "ioredis";
import { z } from "zod/v4";

import { redis } from "@/libs/redis";

const STREAM_KEY_PREFIX = "ai-chat:streams";
const STREAM_TTL_SECONDS = 10 * 60;
const STREAM_TTL_MS = STREAM_TTL_SECONDS * 1000;
const PRODUCER_FLUSH_INTERVAL_MS = 8;
const PRODUCER_FLUSH_CHUNK_COUNT = 8;

type StreamUserInput = {
  userId: string;
  requestId: string;
};

type CreateStreamForUserHandle = {
  abortSignal: AbortSignal;
  startStream(stream: ReadableStream<string>): Promise<Result<void, RedisStreamError>>;
};

type StreamKeys = {
  state: string;
  chunks: string;
  channel: string;
  control: string;
};

type PublishedChunk = {
  index: number;
  value: string;
};

type PublishedMessage =
  | { type: "chunks"; chunks: PublishedChunk[] }
  | { type: "done" }
  | { type: "cancelled" };

type MemorySubscriber = {
  enqueue(value: string): void;
  close(): void;
  error(cause: unknown): void;
};

type MemoryStream = {
  chunks: string[];
  expiresAt: number;
  timeout: ReturnType<typeof setTimeout>;
  subscribers: Set<MemorySubscriber>;
  abortController: AbortController;
  state: "pending" | "active" | "done" | "cancelled";
};

const memoryStreams = new Map<string, MemoryStream>();

export class RedisOperationError extends TaggedError("RedisOperationError")<{
  operation: string;
  key: string;
  message: string;
  cause: unknown;
}> {}

export class StreamAlreadyExistsError extends TaggedError("StreamAlreadyExistsError")<{
  userId: string;
  requestId: string;
  message: string;
}> {}

export class StreamReadError extends TaggedError("StreamReadError")<{
  userId: string;
  requestId: string;
  message: string;
  cause: unknown;
}> {}

export class StreamNotFoundError extends TaggedError("StreamNotFoundError")<{
  userId: string;
  requestId: string;
  message: string;
}> {}

export type RedisStreamError =
  | RedisOperationError
  | StreamAlreadyExistsError
  | StreamReadError
  | StreamNotFoundError;

export type RedisStreamClient = {
  isStreamExist(input: StreamUserInput): Promise<Result<boolean, RedisStreamError>>;
  createStreamForUser(
    input: StreamUserInput,
  ): Promise<Result<CreateStreamForUserHandle, RedisStreamError>>;
  cancelStreamForUser(input: StreamUserInput): Promise<Result<boolean, RedisStreamError>>;
  resumeStreamForUser(
    input: StreamUserInput,
  ): Promise<Result<ReadableStream<string>, RedisStreamError>>;
};

function getStreamId(input: StreamUserInput): string {
  return `user:${input.userId}:request:${input.requestId}`;
}

function getStreamKeys(streamId: string): StreamKeys {
  const baseKey = `${STREAM_KEY_PREFIX}:${streamId}`;

  return {
    state: `${baseKey}:state`,
    chunks: `${baseKey}:chunks`,
    channel: `${baseKey}:channel`,
    control: `${baseKey}:control`,
  };
}

const publishedMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("done") }),
  z.object({ type: z.literal("cancelled") }),
  z.object({
    type: z.literal("chunks"),
    chunks: z.array(z.object({ index: z.number().int().safe(), value: z.string() })),
  }),
]);

function getErrorMessage(cause: unknown): string {
  if (cause instanceof Error) return cause.message;
  return String(cause);
}

function parsePublishedMessage(message: string): PublishedMessage | null {
  try {
    const parsed = publishedMessageSchema.safeParse(JSON.parse(message));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function cleanupSubscriber(subscriber: Redis, channel: string): Promise<void> {
  try {
    await subscriber.unsubscribe(channel);
  } catch {
    // Best-effort cleanup; the connection may already be closed.
  }

  try {
    await subscriber.quit();
  } catch {
    subscriber.disconnect();
  }
}

function closeMemoryStream(streamId: string, state: "done" | "cancelled"): void {
  const memoryStream = memoryStreams.get(streamId);
  if (!memoryStream) return;

  memoryStream.state = state;
  clearTimeout(memoryStream.timeout);
  for (const subscriber of memoryStream.subscribers) {
    subscriber.close();
  }

  memoryStream.subscribers.clear();
  memoryStreams.delete(streamId);
}

function failMemoryStream(streamId: string, cause: unknown): void {
  const memoryStream = memoryStreams.get(streamId);
  if (!memoryStream) return;

  clearTimeout(memoryStream.timeout);
  for (const subscriber of memoryStream.subscribers) {
    subscriber.error(cause);
  }

  memoryStream.subscribers.clear();
  memoryStreams.delete(streamId);
}

function expireMemoryStream(streamId: string): void {
  const memoryStream = memoryStreams.get(streamId);
  if (!memoryStream) return;

  memoryStream.state = "cancelled";
  memoryStream.abortController.abort();
  for (const subscriber of memoryStream.subscribers) {
    subscriber.close();
  }

  memoryStream.subscribers.clear();
  memoryStreams.delete(streamId);
}

function createMemoryResumeStream(streamId: string, memoryStream: MemoryStream): ReadableStream<string> {
  let activeSubscriber: MemorySubscriber | null = null;

  return new ReadableStream<string>({
    start(controller) {
      let isClosed = false;

      if (Date.now() >= memoryStream.expiresAt) {
        expireMemoryStream(streamId);
        controller.close();
        return;
      }

      const subscriber: MemorySubscriber = {
        enqueue(value) {
          if (isClosed) return;

          try {
            controller.enqueue(value);
          } catch {
            isClosed = true;
            memoryStream.subscribers.delete(subscriber);
          }
        },
        close() {
          if (isClosed) return;

          isClosed = true;
          memoryStream.subscribers.delete(subscriber);
          controller.close();
        },
        error(error) {
          if (isClosed) return;

          isClosed = true;
          memoryStream.subscribers.delete(subscriber);
          controller.error(error);
        },
      };

      for (const chunk of memoryStream.chunks) {
        controller.enqueue(chunk);
      }

      if (memoryStream.state === "active" || memoryStream.state === "pending") {
        activeSubscriber = subscriber;
        memoryStream.subscribers.add(subscriber);
        return;
      }

      isClosed = true;
      controller.close();
    },

    cancel() {
      const storedMemoryStream = memoryStreams.get(streamId);
      if (!storedMemoryStream) return;

      if (activeSubscriber) storedMemoryStream.subscribers.delete(activeSubscriber);
      activeSubscriber = null;
    },
  });
}

export function createRedisStreamClient(client: Redis = redis): RedisStreamClient {
  return {
    async isStreamExist(input) {
      const streamId = getStreamId(input);
      const keys = getStreamKeys(streamId);

      const memoryStream = memoryStreams.get(streamId);
      if (memoryStream?.state === "active") return Result.ok(true);

      try {
        const state = await client.get(keys.state);
        return Result.ok(state !== null);
      } catch (cause) {
        return Result.err(
          new RedisOperationError({
            operation: "getStreamState",
            key: keys.state,
            message: getErrorMessage(cause),
            cause,
          }),
        );
      }
    },

    async createStreamForUser(input) {
      const streamId = getStreamId(input);
      const keys = getStreamKeys(streamId);

      try {
        const acquired = await client.set(keys.state, "pending", "EX", STREAM_TTL_SECONDS, "NX");

        if (acquired !== "OK") {
          return Result.err(
            new StreamAlreadyExistsError({
              userId: input.userId,
              requestId: input.requestId,
              message: "Stream already exists for this user request.",
            }),
          );
        }

        await client.del(keys.chunks);
        await client.del(keys.control);

        const abortController = new AbortController();

        const memoryStream: MemoryStream = {
          chunks: [],
          expiresAt: Date.now() + STREAM_TTL_MS,
          timeout: setTimeout(function handleMemoryStreamExpiry() {
            expireMemoryStream(streamId);
          }, STREAM_TTL_MS),
          abortController,
          subscribers: new Set<MemorySubscriber>(),
          state: "pending",
        };
        memoryStreams.set(streamId, memoryStream);

        const controlSubscriber = client.duplicate();
        controlSubscriber.on("message", function handleControl(channel, message) {
          if (channel !== keys.control) return;
          if (message !== "abort") return;

          abortController.abort();
          closeMemoryStream(streamId, "cancelled");
        });
        await controlSubscriber.subscribe(keys.control);

        async function startStream(stream: ReadableStream<string>): Promise<Result<void, RedisStreamError>> {
          const activeMemoryStream = memoryStreams.get(streamId);
          if (!activeMemoryStream) {
            return Result.err(
              new StreamNotFoundError({
                userId: input.userId,
                requestId: input.requestId,
                message: "Stream not found for this user request.",
              }),
            );
          }

          activeMemoryStream.state = "active";
          await client.set(keys.state, "active", "EX", STREAM_TTL_SECONDS);

          const reader = stream.getReader();
          const pendingChunks: PublishedChunk[] = [];
          let nextIndex = 0;
          let flushTimer: ReturnType<typeof setTimeout> | undefined;
          let writeQueue = Promise.resolve();
          let writeError: Error | null = null;

          function enqueueWrite(chunks: PublishedChunk[]): void {
            if (writeError !== null) return;

            writeQueue = writeQueue
              .then(async function writeBatch() {
                if (writeError !== null) return undefined;

                const values: string[] = [];
                for (const chunk of chunks) {
                  values.push(chunk.value);
                }

                await client
                  .pipeline()
                  .rpush(keys.chunks, ...values)
                  .expire(keys.chunks, STREAM_TTL_SECONDS)
                  .publish(keys.channel, JSON.stringify({ type: "chunks", chunks }))
                  .exec();
                return undefined;
              })
              .catch(function storeWriteError(cause) {
                if (writeError === null) {
                  writeError = cause instanceof Error ? cause : new Error(String(cause));
                }
              });
          }

          function flushPendingChunks(): void {
            if (flushTimer !== undefined) {
              clearTimeout(flushTimer);
              flushTimer = undefined;
            }

            if (pendingChunks.length === 0) return;

            const chunks = pendingChunks.splice(0, pendingChunks.length);
            enqueueWrite(chunks);
          }

          function scheduleFlush(): void {
            if (pendingChunks.length >= PRODUCER_FLUSH_CHUNK_COUNT) {
              flushPendingChunks();
              return;
            }

            if (flushTimer !== undefined) return;
            flushTimer = setTimeout(flushPendingChunks, PRODUCER_FLUSH_INTERVAL_MS);
          }

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              if (!memoryStreams.has(streamId)) {
                await reader.cancel().catch(function () {
                  return null;
                });
                break;
              }

              pendingChunks.push({ index: nextIndex, value });
              activeMemoryStream.chunks.push(value);
              for (const subscriber of activeMemoryStream.subscribers) {
                subscriber.enqueue(value);
              }

              nextIndex += 1;
              scheduleFlush();
            }

            flushPendingChunks();

            if (!memoryStreams.has(streamId)) {
              await writeQueue;
              if (writeError !== null) throw writeError;
              return Result.ok(undefined);
            }

            await writeQueue;
            if (writeError !== null) throw writeError;

            const state = await client.get(keys.state);
            if (state === "active") {
              await client
                .pipeline()
                .set(keys.state, "done", "EX", STREAM_TTL_SECONDS)
                .expire(keys.chunks, STREAM_TTL_SECONDS)
                .publish(keys.channel, JSON.stringify({ type: "done" }))
                .exec();
            }

            closeMemoryStream(streamId, "done");
            return Result.ok(undefined);
          } catch (cause) {
            failMemoryStream(streamId, cause);
            await client.del(keys.state, keys.chunks).catch(function () {
              return null;
            });

            return Result.err(
              new RedisOperationError({
                operation: "startStream",
                key: keys.state,
                message: getErrorMessage(cause),
                cause,
              }),
            );
          } finally {
            await cleanupSubscriber(controlSubscriber, keys.control);
          }
        }

        return Result.ok({ abortSignal: abortController.signal, startStream });
      } catch (cause) {
        failMemoryStream(streamId, cause);
        await client.del(keys.state, keys.chunks, keys.control).catch(function () {
          return null;
        });

        return Result.err(
          new RedisOperationError({
            operation: "createStream",
            key: keys.state,
            message: getErrorMessage(cause),
            cause,
          }),
        );
      }
    },

    async cancelStreamForUser(input) {
      const streamId = getStreamId(input);
      const keys = getStreamKeys(streamId);

      const memoryStream = memoryStreams.get(streamId);
      if (memoryStream) {
        memoryStream.abortController.abort();
        closeMemoryStream(streamId, "cancelled");
      }

      try {
        const deletedKeys = await client.del(keys.state, keys.chunks, keys.control);

        if (deletedKeys === 0) {
          return Result.err(
            new StreamNotFoundError({
              userId: input.userId,
              requestId: input.requestId,
              message: "Stream not found for this user request.",
            }),
          );
        }

        await client.publish(keys.control, "abort");
        await client.publish(keys.channel, JSON.stringify({ type: "cancelled" }));

        return Result.ok(true);
      } catch (cause) {
        return Result.err(
          new RedisOperationError({
            operation: "cancelStream",
            key: keys.state,
            message: getErrorMessage(cause),
            cause,
          }),
        );
      }
    },

    async resumeStreamForUser(input) {
      const streamId = getStreamId(input);
      const keys = getStreamKeys(streamId);

      const memoryStream = memoryStreams.get(streamId);
      if (memoryStream?.state === "active") {
        return Result.ok(createMemoryResumeStream(streamId, memoryStream));
      }

      try {
        const state = await client.get(keys.state);

        if (state !== "active") {
          return Result.err(
            new StreamNotFoundError({
              userId: input.userId,
              requestId: input.requestId,
              message: "Stream not found for this user request.",
            }),
          );
        }

        const subscriber = client.duplicate();
        const stream = new ReadableStream<string>({
          async start(controller) {
            let nextIndex = 0;
            let isClosed = false;
            const bufferedLiveChunks = new Map<number, string>();

            function closeStream(): void {
              if (isClosed) return;

              isClosed = true;
              void cleanupSubscriber(subscriber, keys.channel);
              controller.close();
            }

            function failStream(cause: unknown): void {
              if (isClosed) return;

              isClosed = true;
              void cleanupSubscriber(subscriber, keys.channel);
              controller.error(cause);
            }

            function enqueueChunk(index: number, value: string): void {
              if (isClosed || index < nextIndex) return;

              if (index > nextIndex) {
                bufferedLiveChunks.set(index, value);
                return;
              }

              controller.enqueue(value);
              nextIndex += 1;

              while (true) {
                const bufferedChunk = bufferedLiveChunks.get(nextIndex);
                if (bufferedChunk === undefined) return;

                bufferedLiveChunks.delete(nextIndex);
                controller.enqueue(bufferedChunk);
                nextIndex += 1;
              }
            }

            function handlePublishedMessage(channel: string, message: string): void {
              if (channel !== keys.channel) return;

              const publishedMessage = parsePublishedMessage(message);
              if (publishedMessage === null) return;

              if (publishedMessage.type === "done" || publishedMessage.type === "cancelled") {
                closeStream();
                return;
              }

              for (const chunk of publishedMessage.chunks) {
                enqueueChunk(chunk.index, chunk.value);
              }
            }

            try {
              subscriber.on("message", handlePublishedMessage);
              await subscriber.subscribe(keys.channel);

              const replayChunks = await client.lrange(keys.chunks, 0, -1);
              let replayIndex = 0;
              for (const chunk of replayChunks) {
                enqueueChunk(replayIndex, chunk);
                replayIndex += 1;
              }

              const latestState = await client.get(keys.state);
              if (latestState !== "active") closeStream();
            } catch (cause) {
              failStream(cause);
            }
          },

          async cancel() {
            await cleanupSubscriber(subscriber, keys.channel);
          },
        });

        return Result.ok(stream);
      } catch (cause) {
        return Result.err(
          new StreamReadError({
            userId: input.userId,
            requestId: input.requestId,
            message: getErrorMessage(cause),
            cause,
          }),
        );
      }
    },
  };
}

export const redisStreamClient = createRedisStreamClient();
