import React, { useRef, useEffect } from 'react';
import type { TimelineStep } from '@/services/history/WorkflowTimelineService';
import { ChevronRight, ZoomIn, ZoomOut, Maximize2, Image as ImageIcon } from 'lucide-react';

import { useLazyImage } from '../hooks/useLazyImage';

interface WorkflowTimelineProps {
  steps: TimelineStep[];
  activeStepId: string | null;
  onStepSelect: (id: string) => void;
  compareIds: string[];
  onCompareToggle: (id: string) => void;
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
}

const TimelineNodeCard: React.FC<{
  step: TimelineStep;
  isActive: boolean;
  isCompared: boolean;
  compareIndex: number;
  onSelect: (id: string) => void;
  onCompareToggle: (id: string) => void;
}> = ({ step, isActive, isCompared, compareIndex, onSelect, onCompareToggle }) => {
  const imageSlot = step.processingType === 'source' ? 'input' : 'output';
  const { containerRef, src, isLoading } = useLazyImage(step.id, imageSlot);

  return (
    <div 
      ref={containerRef as any}
      data-step-id={step.id}
      className={`timeline-node-card ${isActive ? 'active' : ''} ${isCompared ? 'compared' : ''}`}
      onClick={() => onSelect(step.id)}
    >
      {src ? (
        <img src={src} alt={step.processingType} className="node-thumb" />
      ) : isLoading ? (
        <div className="node-thumb placeholder-loading skeleton-image" style={{ position: 'relative', overflow: 'hidden' }}>
          <div className="skeleton-shimmer" />
        </div>
      ) : (
        <div className="node-thumb grid-img-error" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '90px', background: '#0a0a0b' }}>
          <ImageIcon size={20} style={{ opacity: 0.25, color: '#ffffff' }} />
        </div>
      )}
      
      <div className="node-info">
        <span className="node-type">{step.processingType.toUpperCase()}</span>
        <span className="node-desc" title={step.prompt}>{step.prompt || 'No Prompt'}</span>
        {step.model && <span className="node-model">{step.model.split(' ')[0]}</span>}
      </div>

      {/* Dual Comparison Checkbox Toggle */}
      <button 
        className={`node-compare-check ${isCompared ? 'checked' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          onCompareToggle(step.id);
        }}
        title="Select for comparison"
      >
        {isCompared ? (
          <span className="compare-badge-num">{compareIndex + 1}</span>
        ) : (
          <span className="compare-badge-empty" />
        )}
      </button>
    </div>
  );
};

export const WorkflowTimeline: React.FC<WorkflowTimelineProps> = ({
  steps,
  activeStepId,
  onStepSelect,
  compareIds,
  onCompareToggle,
  zoomLevel,
  onZoomIn,
  onZoomOut,
  onZoomReset
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Auto scroll to active step
  useEffect(() => {
    if (activeStepId && containerRef.current) {
      const activeEl = containerRef.current.querySelector(`[data-step-id="${activeStepId}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [activeStepId]);

  return (
    <div className="workflow-timeline-container">
      {/* Zoom / Layout Controls */}
      <div className="timeline-toolbar">
        <span className="toolbar-title">Workflow Evolution Timeline</span>
        <div className="toolbar-actions">
          <button className="timeline-tool-btn" onClick={onZoomOut} title="Zoom Out"><ZoomOut size={13} /></button>
          <span className="zoom-label">{Math.round(zoomLevel * 100)}%</span>
          <button className="timeline-tool-btn" onClick={onZoomIn} title="Zoom In"><ZoomIn size={13} /></button>
          <button className="timeline-tool-btn" onClick={onZoomReset} title="Reset Zoom"><Maximize2 size={13} /></button>
        </div>
      </div>

      {/* Horizontal Scroll Area */}
      <div 
        ref={containerRef}
        className="timeline-scroll-area"
      >
        <div 
          className="timeline-content"
          style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'left center' }}
        >
          {steps.map((step, idx) => {
            const isActive = activeStepId === step.id;
            const isCompared = compareIds.includes(step.id);
            const compareIndex = compareIds.indexOf(step.id);

            return (
              <React.Fragment key={step.id}>
                {/* Connector Arrow */}
                {idx > 0 && (
                  <div className="timeline-connector">
                    <ChevronRight size={14} className="connector-arrow" />
                  </div>
                )}

                <TimelineNodeCard
                  step={step}
                  isActive={isActive}
                  isCompared={isCompared}
                  compareIndex={compareIndex}
                  onSelect={onStepSelect}
                  onCompareToggle={onCompareToggle}
                />
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};
