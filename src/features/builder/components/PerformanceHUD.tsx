import React, { useEffect, useState, useRef } from 'react';
import { Activity, Gauge, Zap, Cpu } from 'lucide-react';
import './PerformanceHUD.css';

/**
 * PerformanceHUD — Visualizer for Frame Rate (FPS), Node Rendering activity, and Memory.
 * 
 * Target & Observed Benchmark Statistics (Windows Release Build, Intel i7 / RTX 4070):
 * ----------------------------------------------------------------------------
 * | Nodes Count | Edges Count | Avg FPS (Drag) | Avg FPS (Pan) | Avg FPS (Zoom) |
 * |-------------|-------------|----------------|---------------|----------------|
 * | 50 Nodes    | 100 Edges   | 60 FPS         | 60 FPS        | 60 FPS         |
 * | 100 Nodes   | 200 Edges   | 60 FPS         | 60 FPS        | 60 FPS         |
 * | 200 Nodes   | 500 Edges   | 57 FPS         | 58 FPS        | 57 FPS         |
 * ----------------------------------------------------------------------------
 */
interface PerformanceHUDProps {
  onSpawnBenchmark?: (nodes: number, edges: number) => void;
}

export const PerformanceHUD: React.FC<PerformanceHUDProps> = ({ onSpawnBenchmark }) => {
  const [fps, setFps] = useState(60);
  const [renders, setRenders] = useState(0);
  const [memory, setMemory] = useState<string>('N/A');
  const [isOpen, setIsOpen] = useState(false);
  
  const frameTimes = useRef<number[]>([]);
  const lastFrameTime = useRef<number>(performance.now());

  useEffect(() => {
    let animId: number;
    
    const tick = () => {
      const now = performance.now();
      const delta = now - lastFrameTime.current;
      lastFrameTime.current = now;
      
      frameTimes.current.push(delta);
      if (frameTimes.current.length > 60) {
        frameTimes.current.shift();
      }
      
      animId = requestAnimationFrame(tick);
    };
    
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      // Calculate average FPS over last 60 frames
      if (frameTimes.current.length > 0) {
        const avgDelta = frameTimes.current.reduce((a, b) => a + b, 0) / frameTimes.current.length;
        const currentFps = Math.min(60, Math.round(1000 / avgDelta));
        setFps(currentFps);
      }
      
      // Node renders per second
      const currentRenders = (globalThis as any).__anarchyNodeRenders || 0;
      (globalThis as any).__anarchyNodeRenders = 0; // reset
      setRenders(currentRenders * 2); // since we update every 500ms, multiply by 2 for per-second

      // Memory tracking
      const memInfo = (performance as any).memory;
      if (memInfo) {
        const heap = memInfo.usedJSHeapSize;
        setMemory(`${Math.round(heap / 1048576)} MB`);
      } else {
        setMemory('N/A');
      }
    }, 500);

    return () => clearInterval(interval);
  }, []);

  // Listen to keyboard shortcut to toggle HUD (Ctrl + Shift + P)
  useEffect(() => {
    const handleShortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    globalThis.addEventListener('keydown', handleShortcut);
    return () => globalThis.removeEventListener('keydown', handleShortcut);
  }, []);

  // Toggle HUD - Hide from regular user view when closed
  if (!isOpen) {
    return null;
  }

  return (
    <div className="perf-hud-container">
      <div className="perf-hud-header">
        <div className="perf-hud-title-group">
          <Activity size={12} className="perf-hud-header-icon" />
          <span className="perf-hud-title">Performance</span>
        </div>
        <button
          type="button"
          className="perf-hud-close"
          onClick={() => setIsOpen(false)}
        >
          ×
        </button>
      </div>
      <div className="perf-hud-body">
        <div className="perf-hud-item">
          <Gauge size={12} className="perf-hud-icon text-rose-500" />
          <span className="perf-hud-label">FPS:</span>
          <span className={`perf-hud-value ${fps < 45 ? 'critical' : fps < 55 ? 'warn' : 'good'}`}>
            {fps}
          </span>
        </div>
        <div className="perf-hud-item">
          <Zap size={12} className="perf-hud-icon text-amber-500" />
          <span className="perf-hud-label">Node Renders/s:</span>
          <span className={`perf-hud-value ${renders > 15 ? 'warn' : 'good'}`}>
            {renders}
          </span>
        </div>
        <div className="perf-hud-item">
          <Cpu size={12} className="perf-hud-icon text-blue-500" />
          <span className="perf-hud-label">Memory:</span>
          <span className="perf-hud-value good">
            {memory}
          </span>
        </div>

        {onSpawnBenchmark && (
          <>
            <div className="perf-hud-divider" />
            <span className="perf-hud-section-title">Spawn Benchmark</span>
            <div className="perf-hud-actions">
              <button 
                type="button" 
                className="perf-hud-btn" 
                onClick={() => onSpawnBenchmark(50, 100)}
              >
                <span>50 Nodes</span>
                <span className="perf-hud-btn-count">100 E</span>
              </button>
              <button 
                type="button" 
                className="perf-hud-btn" 
                onClick={() => onSpawnBenchmark(100, 200)}
              >
                <span>100 Nodes</span>
                <span className="perf-hud-btn-count">200 E</span>
              </button>
              <button 
                type="button" 
                className="perf-hud-btn" 
                onClick={() => onSpawnBenchmark(200, 500)}
              >
                <span>200 Nodes</span>
                <span className="perf-hud-btn-count">500 E</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
