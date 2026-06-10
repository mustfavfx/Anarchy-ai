import { useState, useEffect, useRef } from 'react';
import { loadThumbnail, revokeObjectUrl } from '../services/HistoryService';

/**
 * Custom viewport lazy loading hook that loads image blobs from IndexedDB
 * and returns a revocable Object URL.
 */
export function useLazyImage(
  entryId: string,
  imageSlot: 'output' | 'input' | 'root_source',
  externalRef?: React.RefObject<HTMLElement | null>
) {
  const [src, setSrc] = useState<string>('');
  const [isIntersecting, setIsIntersecting] = useState(false);
  const internalRef = useRef<HTMLElement | null>(null);

  const containerRef = externalRef ?? internalRef;

  // IntersectionObserver to detect when card enters viewport
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsIntersecting(true);
          observer.disconnect();
        }
      },
      { rootMargin: '150px' } // Load slightly before coming into view
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, [containerRef]);

  // Load thumbnail once visible
  useEffect(() => {
    if (!isIntersecting) return;

    let active = true;
    let resolvedUrl: string | null = null;

    const load = async () => {
      try {
        const url = await loadThumbnail(entryId, imageSlot);
        if (active && url) {
          setSrc(url);
          resolvedUrl = url;
        }
      } catch (err) {
        console.error('[HistoryLazyImage] Failed to load thumbnail:', err);
      }
    };

    load();

    return () => {
      active = false;
      if (resolvedUrl) {
        // Revoke the Object URL on cleanup to prevent memory leaks!
        revokeObjectUrl(resolvedUrl);
      }
    };
  }, [entryId, imageSlot, isIntersecting]);

  return { containerRef, src };
}
