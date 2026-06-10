import React, { useRef, useEffect } from 'react';
import type { TimelineStep } from '../services/WorkflowTimelineService';
import { ChevronRight, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

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

                {/* Node Card */}
                <div 
                  data-step-id={step.id}
                  className={`timeline-node-card ${isActive ? 'active' : ''} ${isCompared ? 'compared' : ''}`}
                  onClick={() => onStepSelect(step.id)}
                >
                  <img src={step.image} alt={step.processingType} className="node-thumb" />
                  
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
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};
