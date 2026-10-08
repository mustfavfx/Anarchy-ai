import { useState, useEffect } from 'react';
import { getLocalImageAsObjectURL, getLocalImage } from '../services/history/HistoryService';
import { getCachedCanvasThumbnail } from '../services/image/memoryThumbnailCache';

export function useResolvedImage(rawImage: string | undefined | null): string | undefined {
  const syncInitial = rawImage
    ? (getCachedCanvasThumbnail(rawImage) || (rawImage.startsWith('data:') || rawImage.startsWith('blob:') ? rawImage : undefined))
    : undefined;
  const [resolvedUrl, setResolvedUrl] = useState<string | undefined>(syncInitial);

  useEffect(() => {
    let active = true;

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
        let cachedUrl = await getLocalImageAsObjectURL(rawImage);

        // Fallback 1: Retrieve raw Base64 data from IndexedDB
        if (!cachedUrl) {
          const b64 = await getLocalImage(rawImage);
          if (b64) cachedUrl = b64;
        }

        // Fallback 2: Check thumbnail / alternate variant keys
        if (!cachedUrl) {
          const cleanKey = rawImage.replace(/^idb:\/\//, '').replace(/_canvas_thumb$/, '');
          const thumbKey = `idb://${cleanKey}_canvas_thumb`;
          const altCached = getCachedCanvasThumbnail(thumbKey) || getCachedCanvasThumbnail(`idb://${cleanKey}`) || getCachedCanvasThumbnail(cleanKey);
          if (altCached) {
            cachedUrl = altCached;
          } else {
            const thumbB64 = await getLocalImage(thumbKey) || await getLocalImage(`idb://${cleanKey}`);
            if (thumbB64) {
              cachedUrl = thumbB64;
            } else {
              const thumbObjUrl = await getLocalImageAsObjectURL(thumbKey);
              if (thumbObjUrl) cachedUrl = thumbObjUrl;
            }
          }
        }

        if (!active) return;

        if (cachedUrl) {
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
