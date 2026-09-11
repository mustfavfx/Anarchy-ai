import React from 'react';
import { useHistoryStore } from '@/stores/historyStore';
import { useLazyImage } from '../hooks/useLazyImage';
import type { HistoryEntry } from '../types';
import { ChevronRight, Image as ImageIcon } from 'lucide-react';

export const ProvenanceNodeCard: React.FC<{
  entryId: string;
  isActive: boolean;
  stepIndex: number;
  totalSteps: number;
  onSelect: () => void;
}> = ({ entryId, isActive, stepIndex, totalSteps, onSelect }) => {
  const { entries: allEntries } = useHistoryStore();
  const entry = allEntries.find(e => e.id === entryId);
  const { containerRef, src, isLoading } = useLazyImage(entryId, 'output');
  if (!entry) return null;
  
  const typeLabel = 
    entry.nodeType === 'source' ? 'Original' :
    entry.nodeType === 'upscale' ? 'Upscale' :
    entry.nodeType === 'variation' ? 'Variation' :
    entry.nodeType === 'edit' ? 'Edit' : 'Canvas';

  const isFinal = stepIndex === totalSteps;
  
  const cfg = entry.params?.cfg !== undefined ? String(entry.params.cfg) : 'Auto';
  const steps = entry.params?.steps !== undefined ? String(entry.params.steps) : 'Auto';
  const strength = entry.params?.strength !== undefined ? String(entry.params.strength) : 'Auto';
  const seed = entry.params?.seed !== undefined ? String(entry.params.seed) : 'Auto';
  const displaySeed = seed !== 'Auto' ? (seed.length > 5 ? '..' + seed.slice(-4) : seed) : 'Auto';
    
  return (
    <div 
      ref={containerRef as any}
      className={`provenance-node-card ${isActive ? 'active' : ''}`}
      onClick={onSelect}
      style={{
        border: isActive ? '1px solid #e11d48' : undefined,
        boxShadow: isActive ? '0 0 16px rgba(225, 29, 72, 0.35), inset 0 0 8px rgba(225, 29, 72, 0.2)' : undefined
      }}
    >
      <div className="provenance-card-header">
        <span className="provenance-step-num">Step {stepIndex}</span>
        <span className="provenance-type-badge">{isFinal ? 'Final' : typeLabel}</span>
      </div>

      <div className="provenance-thumb-wrapper">
        {src ? (
          <img src={src} className="provenance-thumb" alt={entry.label} />
        ) : isLoading ? (
          <div className="provenance-thumb-placeholder skeleton">
            <div className="skeleton-shimmer" style={{ width: '100%', height: '100%' }} />
          </div>
        ) : (
          <div className="provenance-thumb-placeholder error" style={{ background: '#121214' }}>
            <ImageIcon size={14} />
          </div>
        )}
      </div>

      <div className="provenance-info">
        <span className="provenance-model-name" title={entry.model || entry.label}>
          {entry.model ? entry.model.split('/').pop() : (entry.label || entry.type)}
        </span>
        
        <div className="provenance-params-grid">
          <div className="prov-param">
            <span className="prov-param-label">CFG</span>
            <span className="prov-param-val">{cfg}</span>
          </div>
          <div className="prov-param">
            <span className="prov-param-label">Steps</span>
            <span className="prov-param-val">{steps}</span>
          </div>
          <div className="prov-param">
            <span className="prov-param-label">Str</span>
            <span className="prov-param-val">{strength}</span>
          </div>
          <div className="prov-param">
            <span className="prov-param-label">Seed</span>
            <span className="prov-param-val" title={seed}>{displaySeed}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export interface ProvenanceTimelineProps {
  activePath: string[];
  activeId: string;
  onSelect: (entry: HistoryEntry) => void;
}

export const ProvenanceTimeline: React.FC<ProvenanceTimelineProps> = ({ activePath, activeId, onSelect }) => {
  const { entries: allEntries } = useHistoryStore();
  return (
    <div className="provenance-timeline-container">
      {activePath.map((id, index) => {
        const entry = allEntries.find(e => e.id === id);
        if (!entry) return null;
        return (
          <React.Fragment key={id}>
            {index > 0 && (
              <div className="provenance-connector">
                <div className="provenance-connector-line" />
                <ChevronRight size={14} className="provenance-connector-arrow" />
              </div>
            )}
            <ProvenanceNodeCard 
              entryId={id}
              isActive={id === activeId}
              stepIndex={index + 1}
              totalSteps={activePath.length}
              onSelect={() => onSelect(entry)}
            />
          </React.Fragment>
        );
      })}
    </div>
  );
};
