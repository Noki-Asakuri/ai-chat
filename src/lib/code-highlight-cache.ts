const MAX_CACHE_ENTRIES = 500;

const highlightCache: Map<string, string> = new Map();

export function getHighlightFromCache(key: string): string | undefined {
  return highlightCache.get(key);
}

export function setHighlightInCache(key: string, value: string): void {
  if (!key) return;
  highlightCache.set(key, value);

  if (highlightCache.size > MAX_CACHE_ENTRIES) highlightCache.clear();
}

export function clearHighlightCache(): void {
  highlightCache.clear();
}
