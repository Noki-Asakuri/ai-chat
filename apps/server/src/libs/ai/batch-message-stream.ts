import type { UIMessageChunk } from "ai";

/** Coalesce text updates before SSE serialization without delaying stream events. */
export function batchMessageStream() {
  let pending: Extract<UIMessageChunk, { type: "text-delta" | "reasoning-delta" }> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function flush(controller: TransformStreamDefaultController<UIMessageChunk>) {
    clearTimeout(timer);
    timer = undefined;

    if (pending) {
      controller.enqueue(pending);
      pending = undefined;
    }
  }

  function discard() {
    clearTimeout(timer);
    timer = undefined;
    pending = undefined;
  }

  return new TransformStream<UIMessageChunk, UIMessageChunk>({
    transform(chunk, controller) {
      if (
        (chunk.type !== "text-delta" && chunk.type !== "reasoning-delta") ||
        chunk.providerMetadata != null
      ) {
        flush(controller);
        controller.enqueue(chunk);
        return;
      }

      if (pending && (pending.type !== chunk.type || pending.id !== chunk.id)) {
        flush(controller);
      }

      pending = pending ? { ...pending, delta: pending.delta + chunk.delta } : chunk;

      timer ??= setTimeout(() => {
        // A cancelled reader closes the readable side (desiredSize 0, not null), so enqueue throws.
        try {
          flush(controller);
        } catch {
          discard();
        }
      }, 50);
    },
    flush,
  });
}
