type StreamRegistryEntry = {
  controller: AbortController;
  createdAt: number;
};

const streamsById: Map<string, StreamRegistryEntry> = new Map();
const pendingAbortById: Map<string, number> = new Map();
const PENDING_ABORT_TTL_MS = 5 * 60 * 1000;

function pruneExpiredPendingAborts(): void {
  const now = Date.now();

  for (const [streamId, createdAt] of pendingAbortById) {
    if (now - createdAt > PENDING_ABORT_TTL_MS) {
      pendingAbortById.delete(streamId);
    }
  }
}

export function registerStream(streamId: string): AbortController {
  pruneExpiredPendingAborts();

  const controller = new AbortController();
  streamsById.set(streamId, { controller, createdAt: Date.now() });

  if (pendingAbortById.has(streamId)) {
    pendingAbortById.delete(streamId);
    controller.abort();
  }

  return controller;
}

export function abortStream(streamId: string): boolean {
  pruneExpiredPendingAborts();

  const entry = streamsById.get(streamId);
  if (!entry) {
    pendingAbortById.set(streamId, Date.now());
    return true;
  }

  // idempotent: calling abort() multiple times is safe
  entry.controller.abort();
  return true;
}

export function removeStream(streamId: string): void {
  streamsById.delete(streamId);
}

export function hasStream(streamId: string): boolean {
  return streamsById.has(streamId);
}
