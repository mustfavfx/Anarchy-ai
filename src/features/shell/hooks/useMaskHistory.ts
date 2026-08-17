import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

/**
 * Caps how many full-canvas ImageData snapshots we keep in memory.
 * Each snapshot is width*height*4 bytes, so an unbounded stack (the
 * original behavior) can grow to tens of MB in a long drawing session.
 */
const MAX_HISTORY_SIZE = 40;

/** How long to wait after the last change before exporting a PNG via toDataURL. */
const MASK_CHANGE_DEBOUNCE_MS = 150;

export function useMaskHistory(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  onMaskChange?: (maskDataUrl: string | null) => void
) {
  const historyRef = useRef<ImageData[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const debounceTimerRef = useRef<number | null>(null);

  const updateHistoryButtons = useCallback(() => {
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  }, []);

  // toDataURL() re-encodes the whole canvas to PNG — doing that synchronously
  // on every single stroke (the original behavior) can visibly stall the UI.
  // Debounce it so a fast sequence of strokes only pays that cost once.
  const notifyMaskChange = useCallback(() => {
    if (!onMaskChange) return;
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      const canvas = canvasRef.current;
      if (!canvas) return;
      onMaskChange(canvas.toDataURL('image/png'));
    }, MASK_CHANGE_DEBOUNCE_MS);
  }, [canvasRef, onMaskChange]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const pushHistory = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    }
    historyRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));

    if (historyRef.current.length > MAX_HISTORY_SIZE) {
      // Drop the oldest snapshot rather than let the stack grow unbounded.
      historyRef.current.shift();
    }

    historyIndexRef.current = historyRef.current.length - 1;
    updateHistoryButtons();
    notifyMaskChange();
  }, [canvasRef, notifyMaskChange, updateHistoryButtons]);

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current--;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const state = historyRef.current[historyIndexRef.current];
    if (state) ctx.putImageData(state, 0, 0);
    updateHistoryButtons();
  }, [canvasRef, updateHistoryButtons]);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current++;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const state = historyRef.current[historyIndexRef.current];
    if (state) ctx.putImageData(state, 0, 0);
    updateHistoryButtons();
  }, [canvasRef, updateHistoryButtons]);

  /** Wipes the history stack entirely (e.g. the underlying image changed). */
  const resetHistory = useCallback(() => {
    historyRef.current = [];
    historyIndexRef.current = -1;
    updateHistoryButtons();
  }, [updateHistoryButtons]);

  /** Seeds the history stack with a single baseline snapshot. */
  const initHistory = useCallback(
    (imageData: ImageData) => {
      historyRef.current = [imageData];
      historyIndexRef.current = 0;
      updateHistoryButtons();
    },
    [updateHistoryButtons]
  );

  return { canUndo, canRedo, pushHistory, undo, redo, resetHistory, initHistory };
}
