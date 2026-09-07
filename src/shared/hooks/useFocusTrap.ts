import { useEffect, useRef } from 'react';

interface UseFocusTrapOptions {
  isActive: boolean;
  onEscape?: () => void;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])';

export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(
  options: UseFocusTrapOptions
) {
  const containerRef = useRef<T>(null);
  const { isActive, onEscape, initialFocusRef } = options;

  useEffect(() => {
    if (!isActive) return;

    const previousActiveElement = document.activeElement as HTMLElement | null;

    // Set initial focus
    const timer = setTimeout(() => {
      const container = containerRef.current;
      if (!container) return;

      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
      } else {
        const firstFocusable = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
        if (firstFocusable) {
          firstFocusable.focus();
        } else {
          container.focus();
        }
      }
    }, 50);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onEscape?.();
        return;
      }

      const container = containerRef.current;
      if (!container) return;

      if (event.key === 'Tab') {
        const focusableElements = Array.from(
          container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        ).filter(el => el.offsetParent !== null); // only visible elements

        if (focusableElements.length === 0) {
          event.preventDefault();
          return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey) {
          if (document.activeElement === firstElement || !container.contains(document.activeElement)) {
            event.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement || !container.contains(document.activeElement)) {
            event.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', handleKeyDown);
      if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
        previousActiveElement.focus();
      }
    };
  }, [isActive, onEscape, initialFocusRef]);

  return containerRef;
}
