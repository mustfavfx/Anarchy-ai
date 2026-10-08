import { useState, useEffect } from 'react';
import { getLocalImageAsObjectURL, revokeObjectUrl } from '../services/history/HistoryService';
import { getCachedCanvasThumbnail } from '../services/image/memoryThumbnailCache';

export function useResolvedImage(rawImage: string | undefined | null): string | undefined {
  const syncInitial = rawImage
    ? (getCachedCanvasThumbnail(rawImage) || (rawImage.startsWith('data:') || rawImage.startsWith('blob:') ? rawImage : undefined))
    : undefined;
  const [resolvedUrl, setResolvedUrl] = useState<string | undefined>(syncInitial);

  useEffect(() => {
    let active = true;
    let currentBlobUrl: string | undefined = undefined;

    if (!rawImage || typeof rawImage !== 'string') {
      setResolvedUrl(undefined);
      return;
    }

    const syncCached = getCachedCanvasThumbnail(rawImage);
    if (syncCached) {
      setResolvedUrl(syncCached);
    }

    const resolveImage = async () => {
      if (rawImage.startsWith('idb://')) {
        const cachedUrl = await getLocalImageAsObjectURL(rawImage);
        if (!active) {
          if (cachedUrl && cachedUrl.startsWith('blob:')) {
            URL.revokeObjectURL(cachedUrl);
          }
          return;
        }
        if (cachedUrl) {
          if (cachedUrl.startsWith('blob:')) {
            currentBlobUrl = cachedUrl;
          }
          setResolvedUrl(cachedUrl);
        } else {
          setResolvedUrl(syncCached || undefined);
        }
        return;
      }

      if (!active) return;

      if (rawImage.startsWith('blob:')) {
        // blob: URLs are already local object URLs — pass through directly.
        setResolvedUrl(rawImage);
      } else if (rawImage.startsWith('data:')) {
        // data: URIs are natively rendered by HTML <img> without fetch().
        // Passing through directly avoids blocking the main JavaScript thread
        // with multi-million-iteration atob / Uint8Array conversion loops.
        setResolvedUrl(rawImage);
      } else {
        setResolvedUrl(rawImage);
      }
    };

    resolveImage();

    return () => {
      active = false;
    };
  }, [rawImage]);

  return resolvedUrl;
}
