type StreamRegistryEntry = {
  controller: AbortController;
  createdAt: number;
};

const streamsById: Map<string, StreamRegistryEntry> = new Map();

export function registerStream(streamId: string): AbortController {
  const controller = new AbortController();
  streamsById.set(streamId, { controller, createdAt: Date.now() });
  return controller;
}

export function abortStream(streamId: string): boolean {
  const entry = streamsById.get(streamId);
  if (!entry) return false;

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