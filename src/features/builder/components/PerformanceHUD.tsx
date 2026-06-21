import React, { useEffect, useState, useRef } from 'react';
import { Activity, Gauge, Zap } from 'lucide-react';
import './PerformanceHUD.css';

export const PerformanceHUD: React.FC = () => {
  const [fps, setFps] = useState(60);
  const [renders, setRenders] = useState(0);
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
    }, 500);

    return () => clearInterval(interval);
  }, []);

  // Toggle HUD
  if (!isOpen) {
    return (
      <button
        type="button"
        className="perf-hud-toggle-btn"
        onClick={() => setIsOpen(true)}
        title="Show Performance HUD"
      >
        <Activity size={14} />
      </button>
    );
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
      </div>
    </div>
  );
};
