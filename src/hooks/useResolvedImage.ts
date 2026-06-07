import { useState, useEffect } from 'react';
import { getLocalImage } from '../services/history/HistoryService';

export function useResolvedImage(rawImage: string | undefined | null): string | undefined {
  const [resolvedUrl, setResolvedUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    let active = true;
    let currentBlobUrl: string | undefined = undefined;

    if (!rawImage) {
      setResolvedUrl(undefined);
      return;
    }

    const resolveImage = async () => {
      let rawUrl = rawImage;
      if (rawImage.startsWith('idb://')) {
        const cached = await getLocalImage(rawImage);
        if (cached) rawUrl = cached;
      }

      if (!active) return;

      if (rawUrl.startsWith('data:')) {
        try {
          const response = await fetch(rawUrl);
          const blob = await response.blob();
          if (!active) return;
          const blobUrl = URL.createObjectURL(blob);
          currentBlobUrl = blobUrl;
          setResolvedUrl(blobUrl);
        } catch {
          if (active) setResolvedUrl(rawUrl);
        }
      } else {
        setResolvedUrl(rawUrl);
      }
    };

    resolveImage();

    return () => {
      active = false;
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
      }
    };
  }, [rawImage]);

  return resolvedUrl;
}
