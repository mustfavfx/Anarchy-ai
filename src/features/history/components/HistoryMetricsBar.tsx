import React, { useState } from 'react';
import { Zap, Clock, TrendingUp, Cpu, BarChart2, ChevronDown, ChevronUp } from 'lucide-react';
import { useHistoryMetrics } from '../hooks/useHistoryMetrics';
import type { HistoryEntry } from '../types';

interface HistoryMetricsBarProps {
  entries: HistoryEntry[];
}

function formatMs(ms: number): string {
  if (ms <= 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  const s = (ms / 1000).toFixed(1);
  return `${s}s`;
}

export const HistoryMetricsBar: React.FC<HistoryMetricsBarProps> = ({ entries }) => {
  const metrics = useHistoryMetrics(entries);
  const [expanded, setExpanded] = useState(false);

  if (entries.length === 0) return null;

  return (
    <div className="history-metrics-bar">
      {/* Primary row — always visible */}
      <div className="metrics-primary-row">
        <div className="metric-chip">
          <Zap size={11} className="metric-chip-icon" />
          <span className="metric-chip-val">{metrics.totalGenerations}</span>
          <span className="metric-chip-label">Generated</span>
        </div>

        {metrics.totalUpscales > 0 && (
          <div className="metric-chip">
            <TrendingUp size={11} className="metric-chip-icon" />
            <span className="metric-chip-val">{metrics.totalUpscales}</span>
            <span className="metric-chip-label">Upscaled</span>
          </div>
        )}

        <div className="metric-chip">
          <Clock size={11} className="metric-chip-icon" />
          <span className="metric-chip-val">{formatMs(metrics.avgDurationMs)}</span>
          <span className="metric-chip-label">Avg Time</span>
        </div>

        {metrics.topModel && (
          <div className="metric-chip">
            <Cpu size={11} className="metric-chip-icon" />
            <span className="metric-chip-val">{metrics.topModel.slice(0, 16)}</span>
            <span className="metric-chip-label">Top Model</span>
          </div>
        )}

        <div className="metric-chip">
          <BarChart2 size={11} className="metric-chip-icon" />
          <span className="metric-chip-val">{metrics.todayCount}</span>
          <span className="metric-chip-label">Today</span>
        </div>

        <button
          className="metrics-expand-btn"
          onClick={() => setExpanded(v => !v)}
          title={expanded ? 'Hide details' : 'Show more metrics'}
        >
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {/* Secondary row — expanded details */}
      {expanded && (
        <div className="metrics-secondary-row">
          <div className="metric-detail">
            <span className="metric-detail-label">Fastest</span>
            <span className="metric-detail-val">{formatMs(metrics.fastestMs)}</span>
          </div>
          <div className="metric-detail">
            <span className="metric-detail-label">Slowest</span>
            <span className="metric-detail-val">{formatMs(metrics.slowestMs)}</span>
          </div>
          <div className="metric-detail">
            <span className="metric-detail-label">Total Time</span>
            <span className="metric-detail-val">{formatMs(metrics.totalDurationMs)}</span>
          </div>
          <div className="metric-detail">
            <span className="metric-detail-label">This Week</span>
            <span className="metric-detail-val">{metrics.weekCount}</span>
          </div>
          <div className="metric-detail">
            <span className="metric-detail-label">Avg Nodes</span>
            <span className="metric-detail-val">{metrics.avgNodeCount}</span>
          </div>
          <div className="metric-detail">
            <span className="metric-detail-label">Peak Nodes</span>
            <span className="metric-detail-val">{metrics.peakNodeCount}</span>
          </div>

          {/* Model usage mini-chart */}
          {Object.keys(metrics.modelUsage).length > 1 && (
            <div className="metrics-model-chart">
              {Object.entries(metrics.modelUsage)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([model, count]) => {
                  const pct = Math.round((count / entries.length) * 100);
                  return (
                    <div key={model} className="model-bar-row" title={`${model}: ${count} uses`}>
                      <span className="model-bar-label">{model.slice(0, 18)}</span>
                      <div className="model-bar-track">
                        <div className="model-bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="model-bar-pct">{pct}%</span>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
