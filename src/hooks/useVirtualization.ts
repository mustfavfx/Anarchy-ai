/**
 * Node Virtualization Hook
 * Optimizes rendering performance for large node graphs
 * Only renders nodes that are visible in the viewport
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Node } from '@xyflow/react';

interface ViewportBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface VirtualizationOptions {
  /** Number of nodes to render outside the visible viewport (buffer) */
  overscan?: number;
  /** Minimum number of nodes before virtualization kicks in */
  threshold?: number;
  /** Node width for estimation */
  nodeWidth?: number;
  /** Node height for estimation */
  nodeHeight?: number;
}

interface VirtualizationResult {
  /** Filtered nodes that should be rendered */
  visibleNodes: Node[];
  /** Whether virtualization is active */
  isVirtualized: boolean;
  /** Total node count */
  totalCount: number;
  /** Visible node count */
  visibleCount: number;
  /** Update viewport bounds (call when viewport changes) */
  updateViewport: (bounds: ViewportBounds) => void;
}

/**
 * Hook for virtualizing large node graphs
 * Only renders nodes that are visible in the current viewport
 */
export function useNodeVirtualization(
  nodes: Node[],
  options: VirtualizationOptions = {}
): VirtualizationResult {
  const {
    overscan = 2,
    threshold = 50,
    nodeWidth = 200,
    nodeHeight = 150,
  } = options;

  const [viewport, setViewport] = useState<ViewportBounds>({
    x: -1000,
    y: -1000,
    width: 3000,
    height: 2000,
  });

  const lastUpdateRef = useRef(0);
  const pendingUpdateRef = useRef<ViewportBounds | null>(null);

  // Throttled viewport update to prevent excessive re-renders
  const updateViewport = useCallback((bounds: ViewportBounds) => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateRef.current;
    
    // Always store the latest bounds
    pendingUpdateRef.current = bounds;
    
    // Throttle updates to max 10 per second
    if (timeSinceLastUpdate < 100) {
      // Schedule update if not already scheduled
      if (!pendingUpdateRef.current) {
        setTimeout(() => {
          if (pendingUpdateRef.current) {
            setViewport(pendingUpdateRef.current);
            lastUpdateRef.current = Date.now();
            pendingUpdateRef.current = null;
          }
        }, 100 - timeSinceLastUpdate);
      }
      return;
    }
    
    setViewport(bounds);
    lastUpdateRef.current = now;
    pendingUpdateRef.current = null;
  }, []);

  // Determine if virtualization should be active
  const isVirtualized = useMemo(() => {
    return nodes.length > threshold;
  }, [nodes.length, threshold]);

  // Calculate visible nodes
  const visibleNodes = useMemo(() => {
    if (!isVirtualized) {
      return nodes;
    }

    // Expand viewport by overscan amount
    const expandedViewport = {
      x: viewport.x - nodeWidth * overscan,
      y: viewport.y - nodeHeight * overscan,
      width: viewport.width + nodeWidth * overscan * 2,
      height: viewport.height + nodeHeight * overscan * 2,
    };

    return nodes.filter((node) => {
      const nodeX = node.position.x;
      const nodeY = node.position.y;
      
      // Check if node is within expanded viewport
      return (
        nodeX + nodeWidth > expandedViewport.x &&
        nodeX < expandedViewport.x + expandedViewport.width &&
        nodeY + nodeHeight > expandedViewport.y &&
        nodeY < expandedViewport.y + expandedViewport.height
      );
    });
  }, [nodes, viewport, isVirtualized, overscan, nodeWidth, nodeHeight]);

  // Cleanup pending updates on unmount
  useEffect(() => {
    return () => {
      pendingUpdateRef.current = null;
    };
  }, []);

  return {
    visibleNodes,
    isVirtualized,
    totalCount: nodes.length,
    visibleCount: visibleNodes.length,
    updateViewport,
  };
}

/**
 * Performance monitoring hook for node graphs
 */
export function usePerformanceMonitor(enabled: boolean = true) {
  const metricsRef = useRef({
    frameCount: 0,
    lastTime: 0,
    fps: 60,
  });

  const [fps, setFps] = useState(60);
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    let animationId: number;
    const metrics = metricsRef.current;

    const measure = () => {
      const now = performance.now();
      metrics.frameCount++;

      if (now - metrics.lastTime >= 1000) {
        const currentFps = metrics.frameCount;
        metrics.fps = currentFps;
        setFps(currentFps);
        setIsSlow(currentFps < 30);
        
        metrics.frameCount = 0;
        metrics.lastTime = now;
      }

      animationId = requestAnimationFrame(measure);
    };

    metrics.lastTime = performance.now();
    animationId = requestAnimationFrame(measure);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [enabled]);

  return { fps, isSlow };
}

/**
 * Debounced node updates for better performance
 */
export function useDebouncedNodes<T>(
  nodes: T[],
  delay: number = 100
): T[] {
  const [debouncedNodes, setDebouncedNodes] = useState(nodes);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setDebouncedNodes(nodes);
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [nodes, delay]);

  return debouncedNodes;
}
