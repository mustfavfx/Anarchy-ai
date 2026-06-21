import { useState, useEffect, useCallback } from 'react';
import { loadThumbnail, revokeObjectUrl } from '@/services/history/HistoryService';
import { logger } from '@/utils/logger';

/**
 * Custom viewport lazy loading hook that loads image blobs from IndexedDB
 * and returns a revocable Object URL.
 *
 * Uses a callback ref pattern so the IntersectionObserver is guaranteed to
 * attach after the DOM node is actually mounted (plain useRef + useEffect
 * misses the initial mount because containerRef.current is still null when
 * the effect first runs).
 */
export function useLazyImage(
  entryId: string,
  imageSlot: 'output' | 'input' | 'root_source',
  // externalRef kept for backwards-compat signature but no longer used internally
  _externalRef?: React.RefObject<HTMLElement | null>
) {
  const [src, setSrc] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);

  // Callback ref: called synchronously by React when the DOM node is
  // mounted or unmounted, so `node` is always up-to-date.
  const containerRef = useCallback((el: HTMLElement | null) => {
    setNode(el);
  }, []);

  // IntersectionObserver — re-runs whenever the DOM node changes
  useEffect(() => {
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsIntersecting(true);
          observer.disconnect();
        }
      },
      { rootMargin: '150px' } // Load slightly before entering the viewport
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [node]);

  // Load the thumbnail once the card is visible
  useEffect(() => {
    if (!isIntersecting) return;

    let active = true;
    let resolvedUrl: string | null = null;

    const load = async () => {
      setIsLoading(true);
      setError(false);
      try {
        const url = await loadThumbnail(entryId, imageSlot);
        
        // Log the lazy image query result for diagnostic purposes in dev mode only
        if (import.meta.env.DEV) {
          logger.log('[HistoryLazyImage]', entryId, imageSlot, url ? 'Success' : 'Failed');
        }
        
        if (active) {
          if (url) {
            setSrc(url);
            resolvedUrl = url;
            setError(false);
          } else {
            setError(true);
          }
          setIsLoading(false);
        }
      } catch (err) {
        console.error('[HistoryLazyImage] Failed to load thumbnail:', err);
        if (active) {
          setError(true);
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      active = false;
      if (resolvedUrl) {
        // Revoke the Object URL on cleanup to prevent memory leaks
        revokeObjectUrl(resolvedUrl);
      }
    };
  }, [entryId, imageSlot, isIntersecting]);

  return { containerRef, src, isLoading, error };
}
