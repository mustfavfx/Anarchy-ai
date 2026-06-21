import { useState, useEffect } from 'react';
import { getLocalImageAsObjectURL, revokeObjectUrl } from '../services/history/HistoryService';

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
          setResolvedUrl(undefined);
        }
        return;
      }

      if (!active) return;

      if (rawImage.startsWith('blob:')) {
        // blob: URLs are already local object URLs — pass through directly.
        setResolvedUrl(rawImage);
      } else if (rawImage.startsWith('data:')) {
        // Convert data URI → Blob URL locally without fetch().
        // fetch(data:...) is blocked by CSP connect-src and is unnecessary;
        // the conversion can be done entirely in-memory with atob.
        try {
          const [header, base64] = rawImage.split(',');
          const mimeMatch = header.match(/data:([^;]+)/);
          const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
          const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: mime });
          if (!active) return;
          const blobUrl = URL.createObjectURL(blob);
          currentBlobUrl = blobUrl;
          setResolvedUrl(blobUrl);
        } catch {
          // If atob fails (malformed data URI), fall back to the raw string.
          if (active) setResolvedUrl(rawImage);
        }
      } else {
        setResolvedUrl(rawImage);
      }
    };

    resolveImage();

    return () => {
      active = false;
      if (currentBlobUrl) {
        revokeObjectUrl(currentBlobUrl);
      }
    };
  }, [rawImage]);

  return resolvedUrl;
}
