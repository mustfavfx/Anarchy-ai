import { useState, useCallback } from 'react';

export function useWorkflowTimeline() {
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const handleZoomIn = useCallback(() => setZoomLevel(z => Math.min(1.8, z + 0.15)), []);
  const handleZoomOut = useCallback(() => setZoomLevel(z => Math.max(0.5, z - 0.15)), []);
  const handleZoomReset = useCallback(() => setZoomLevel(1.0), []);

  const toggleCompareId = useCallback((id: string) => {
    setCompareIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(x => x !== id);
      }
      if (prev.length >= 2) {
        // Replace second comparison slot
        return [prev[0], id];
      }
      return [...prev, id];
    });
  }, []);

  const clearCompare = useCallback(() => setCompareIds([]), []);

  return {
    activeStepId,
    setActiveStepId,
    zoomLevel,
    setZoomLevel,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    compareIds,
    setCompareIds,
    toggleCompareId,
    clearCompare
  };
}
