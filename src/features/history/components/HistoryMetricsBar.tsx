import React, { useState } from 'react';
import { Zap, Clock, TrendingUp, Cpu, Calendar, Star, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { useHistoryMetrics } from '../hooks/useHistoryMetrics';
import { useHistoryStore } from '@/stores/historyStore';
import type { HistoryEntry } from '../types';

const MODEL_NAME_MAP: Record<string, string> = {
  'bytedance/seedream-5-pro': 'Seedream 5 Pro',
  'bytedance/seedream-4.5': 'Seedream 4.5',
  'google/nano-banana-2': 'Google Nano Banana 2',
  'google/nano-banana-2-lite': 'Nano Banana 2 Lite',
  'google/nano-banana': 'Google Nano Banana',
  'krea/krea-2-large': 'Krea 2 Large',
  'openai/gpt-image-2': 'GPT Image 2',
  'openai/gpt-image-2.5-flare': 'GPT Image 2.5 Flare',
  'openai/gpt-image-2.5-sunburst': 'GPT Image 2.5 Sunburst',
  'openai/dall-e-3': 'DALL·E 3',
  'prunaai/p-image': 'Pruna AI',
  'prunaai/p-image-upscale': 'Pruna AI Upscale',
  'philz1337x/clarity-pro-upscaler': 'Anarchy Upscale',
  'topazlabs/image-upscale': 'Topaz Upscale',
  'black-forest-labs/flux-1.1-pro': 'FLUX 1.1 Pro',
  'black-forest-labs/flux-schnell': 'FLUX Schnell',
  'black-forest-labs/flux-dev': 'FLUX Dev',
  'stability-ai/sdxl': 'SDXL',
};

function formatModelName(slug: string): string {
  if (!slug) return 'Unknown';
  if (MODEL_NAME_MAP[slug]) return MODEL_NAME_MAP[slug];
  const name = slug.includes('/') ? slug.split('/')[1] : slug;
  return name
    .split(/[-_]/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

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
  const { stats } = useHistoryStore();
  const [expanded, setExpanded] = useState(false);

  if (entries.length === 0) return null;

  return (
    <div className="history-metrics-bar">
      {/* Unified Primary Analytics Strip */}
      <div className="metrics-primary-row">
        <div className="metric-chip highlight-chip">
          <Zap size={12} className="metric-chip-icon accent-icon" />
          <span className="metric-chip-val">{stats.total || entries.length}</span>
          <span className="metric-chip-label">Total</span>
        </div>

        <div className="metric-chip">
          <Sparkles size={12} className="metric-chip-icon" />
          <span className="metric-chip-val">{metrics.totalGenerations}</span>
          <span className="metric-chip-label">Generated</span>
        </div>

        {metrics.totalUpscales > 0 && (
          <div className="metric-chip">
            <TrendingUp size={12} className="metric-chip-icon" />
            <span className="metric-chip-val">{metrics.totalUpscales}</span>
            <span className="metric-chip-label">Upscaled</span>
          </div>
        )}

        <div className="metric-chip">
          <Clock size={12} className="metric-chip-icon" />
          <span className="metric-chip-val">{formatMs(metrics.avgDurationMs)}</span>
          <span className="metric-chip-label">Avg Render</span>
        </div>

        {metrics.topModel && (
          <div className="metric-chip model-chip">
            <Cpu size={12} className="metric-chip-icon" />
            <span className="metric-chip-val">{formatModelName(metrics.topModel)}</span>
            <span className="metric-chip-label">Top Model</span>
          </div>
        )}

        <div className="metric-chip">
          <Calendar size={12} className="metric-chip-icon" />
          <span className="metric-chip-val">{stats.todayCount ?? metrics.todayCount}</span>
          <span className="metric-chip-label">Today</span>
        </div>

        {stats.starred > 0 && (
          <div className="metric-chip star-chip">
            <Star size={12} className="metric-chip-icon star-icon" />
            <span className="metric-chip-val">{stats.starred}</span>
            <span className="metric-chip-label">Starred</span>
          </div>
        )}

        <button
          className="metrics-expand-btn"
          onClick={() => setExpanded(v => !v)}
          title={expanded ? 'Hide extra analytics' : 'Show detailed analytics'}
        >
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      {/* Secondary Row — Detailed Performance Analytics */}
      {expanded && (
        <div className="metrics-secondary-row">
          <div className="metric-detail">
            <span className="metric-detail-label">Fastest Render</span>
            <span className="metric-detail-val">{formatMs(metrics.fastestMs)}</span>
          </div>
          <div className="metric-detail">
            <span className="metric-detail-label">Slowest Render</span>
            <span className="metric-detail-val">{formatMs(metrics.slowestMs)}</span>
          </div>
          <div className="metric-detail">
            <span className="metric-detail-label">Total Compute Time</span>
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
            <span className="metric-detail-label">Peak Graph Nodes</span>
            <span className="metric-detail-val">{metrics.peakNodeCount}</span>
          </div>

          {/* Model distribution */}
          {Object.keys(metrics.modelUsage).length > 1 && (
            <div className="metrics-model-chart">
              {Object.entries(metrics.modelUsage).map(([model, count]) => {
                const pct = Math.round((count / entries.length) * 100);
                return (
                  <div key={model} className="model-chart-bar-item" title={`${formatModelName(model)}: ${count} items (${pct}%)`}>
                    <span className="model-chart-name">{formatModelName(model)}</span>
                    <div className="model-chart-bar-track">
                      <div className="model-chart-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="model-chart-pct">{pct}%</span>
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
