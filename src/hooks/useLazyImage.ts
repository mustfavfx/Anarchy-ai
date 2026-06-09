import { useState, useEffect, useRef } from 'react';
import { loadFullImage } from '../services/history/HistoryService';

/**
 * Lazy-loads a history image when its container enters the viewport.
 *
 * @param entryId    - history entry ID
 * @param imageSlot  - 'input' or 'output'
 * @param inlineImage - pre-existing thumbnail (skips fetch if present)
 * @param externalRef - optional shared ref (lets multiple hook instances share one observer target)
 */
export function useLazyImage(
  entryId: string,
  imageSlot: 'input' | 'output',
  inlineImage: string | undefined | null,
  externalRef?: React.RefObject<HTMLElement | null>,
) {
  const [src, setSrc] = useState<string>('');
  const [isIntersecting, setIsIntersecting] = useState(false);
  const internalRef = useRef<HTMLElement | null>(null);

  // Use the caller's ref if provided, otherwise fall back to our own
  const containerRef = externalRef ?? internalRef;

  // When we already have an inline thumbnail, use it immediately
  useEffect(() => {
    if (inlineImage) {
      setSrc(inlineImage);
    }
  }, [inlineImage]);

  // Fetch from IndexedDB once the element is visible
  useEffect(() => {
    if (inlineImage) return; // already have the image
    if (!isIntersecting) return;

    let active = true;
    const load = async () => {
      try {
        const img = await loadFullImage(entryId, imageSlot);
        if (active && img) setSrc(img);
      } catch (err) {
        console.error(`[useLazyImage] Failed to load ${imageSlot} for ${entryId}:`, err);
      }
    };
    load();
    return () => { active = false; };
  }, [entryId, imageSlot, inlineImage, isIntersecting]);

  // IntersectionObserver — watches containerRef
  useEffect(() => {
    if (inlineImage) return; // nothing to observe

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsIntersecting(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' },
    );

    const el = containerRef.current;
    if (el) observer.observe(el);

    return () => {
      if (el) observer.unobserve(el);
      observer.disconnect();
    };
  }, [entryId, inlineImage, containerRef]);

  return { containerRef, src };
}
