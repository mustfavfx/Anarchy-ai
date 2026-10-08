const memoryThumbnailCache = new Map<string, string>();
const inFlightThumbnails = new Map<string, Promise<string>>();

const MAX_CACHE_ENTRIES = 120;

export function trimMemoryCache(): void {
  if (memoryThumbnailCache.size > MAX_CACHE_ENTRIES) {
    const keysToDelete = Array.from(memoryThumbnailCache.keys()).slice(0, 40);
    keysToDelete.forEach(k => {
      memoryThumbnailCache.delete(k);
    });
  }
}

/**
 * Invalidates any cached thumbnail in memory or in-flight promises for the given key.
 */
export function invalidateCanvasThumbnail(rawKeyOrUrl?: string | null): void {
  if (!rawKeyOrUrl) return;
  const cleanKey = rawKeyOrUrl.replace(/^idb:\/\//, '').replace(/_canvas_thumb$/, '');
  const keysToPurge = [
    rawKeyOrUrl,
    cleanKey,
    `idb://${cleanKey}`,
    `idb://${cleanKey}_canvas_thumb`,
    `${cleanKey}_canvas_thumb`
  ];
  for (const k of keysToPurge) {
    memoryThumbnailCache.delete(k);
    inFlightThumbnails.delete(k);
  }
}

/**
 * Primes memory thumbnail cache directly so components can render immediately
 * without waiting on IndexedDB or thumbnail creation.
 */
export function primeCanvasThumbnail(rawKeyOrUrl?: string | null, value?: string | null): void {
  if (!rawKeyOrUrl || !value) return;
  const cleanKey = rawKeyOrUrl.replace(/^idb:\/\//, '').replace(/_canvas_thumb$/, '');
  memoryThumbnailCache.set(rawKeyOrUrl, value);
  memoryThumbnailCache.set(cleanKey, value);
  memoryThumbnailCache.set(`idb://${cleanKey}`, value);
  memoryThumbnailCache.set(`idb://${cleanKey}_canvas_thumb`, value);
  memoryThumbnailCache.set(`${cleanKey}_canvas_thumb`, value);
}

/**
 * Synchronously retrieves any primed or cached canvas thumbnail proxy URL from memory.
 */
export function getCachedCanvasThumbnail(rawKeyOrUrl?: string | null): string | undefined {
  if (!rawKeyOrUrl) return undefined;
  const direct = memoryThumbnailCache.get(rawKeyOrUrl);
  if (direct) return direct;
  const cleanKey = rawKeyOrUrl.replace(/^idb:\/\//, '').replace(/_canvas_thumb$/, '');
  return memoryThumbnailCache.get(`idb://${cleanKey}_canvas_thumb`) ||
         memoryThumbnailCache.get(`${cleanKey}_canvas_thumb`) ||
         memoryThumbnailCache.get(`idb://${cleanKey}`) ||
         memoryThumbnailCache.get(cleanKey);
}

export { memoryThumbnailCache, inFlightThumbnails };
