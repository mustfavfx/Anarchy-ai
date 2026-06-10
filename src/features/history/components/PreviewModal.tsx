import React, { useState, useEffect, useRef } from 'react';
import type { HistoryEntry } from '../types';
import { 
  loadFullImage, 
  loadWorkflowTree, 
  formatTime, 
  formatDuration
} from '../services/HistoryService';
import { buildWorkflowTimeline } from '../services/WorkflowTimelineService';
import type { TimelineStep } from '../services/WorkflowTimelineService';
import { useWorkflowTimeline } from '../hooks/useWorkflowTimeline';
import { WorkflowTimeline } from './WorkflowTimeline';
import { 
  X, Copy, RotateCcw, FolderOpen, Save, Star, 
  ChevronLeft, ChevronRight, Eye, Check, Sliders, ChevronsLeftRight
} from 'lucide-react';
import { logger } from '../../../utils/logger';

interface PreviewModalProps {
  preview: HistoryEntry;
  onClose: () => void;
  onNavigate: (dir: 'next' | 'prev') => void;
  hasPrev: boolean;
  hasNext: boolean;
  onStar: (e: any, id: string) => void;
  onOpenWorkflow: (entry: HistoryEntry) => void;
  onOpenExport: (url: string, name: string) => void;
  onSendToCanvas: (url: string) => void;
  onSendGroupToCanvas: (urls: string[]) => void;
  onReusePrompt: (prompt: string, id: string) => void;
}

export const PreviewModal: React.FC<PreviewModalProps> = ({
  preview,
  onClose,
  onNavigate,
  hasPrev,
  hasNext,
  onStar,
  onOpenWorkflow,
  onOpenExport,
  onSendToCanvas,
  onSendGroupToCanvas,
  onReusePrompt
}) => {
  const [timelineSteps, setTimelineSteps] = useState<TimelineStep[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  
  // Slider states
  const [sliderPos, setSliderPos] = useState(50);
  const sliderRef = useRef<HTMLButtonElement | null>(null);
  const isDragging = useRef(false);

  const {
    activeStepId,
    setActiveStepId,
    zoomLevel,
    compareIds,
    toggleCompareId,
    clearCompare,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset
  } = useWorkflowTimeline();

  // 1. Keyboard Navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && hasNext) { e.preventDefault(); onNavigate('next'); }
      if (e.key === 'ArrowLeft' && hasPrev) { e.preventDefault(); onNavigate('prev'); }
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [hasPrev, hasNext, onNavigate, onClose]);

  // 2. Fetch full resolution media and build workflow evolution timeline
  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setTimelineSteps([]);
    setActiveStepId(null);
    clearCompare();

    const loadTimelineData = async () => {
      try {
        const fullInput = await loadFullImage(preview.id, 'input');
        const fullOutput = await loadFullImage(preview.id, 'output');
        const nodeTree = await loadWorkflowTree(preview.id);

        if (!active) return;

        const steps = await buildWorkflowTimeline(preview, nodeTree, fullInput, fullOutput);

        if (!active) return;
        setTimelineSteps(steps);
        setIsLoading(false);

        if (steps.length > 0) {
          // Set terminal step as default active step
          const defaultStep = steps[steps.length - 1];
          setActiveStepId(defaultStep.id);
        }
      } catch (err) {
        logger.error('[PreviewModal] Failed to load timeline data:', err);
      }
    };

    loadTimelineData();
    return () => { active = false; };
  }, [preview.id]);

  // 3. Slider Drag Event Handlers
  const handleSliderDown = () => { isDragging.current = true; };
  
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!isDragging.current || !sliderRef.current) return;
      const rect = sliderRef.current.getBoundingClientRect();
      const pos = ((e.clientX - rect.left) / rect.width) * 100;
      setSliderPos(Math.max(0, Math.min(100, pos)));
    };
    
    const handleUp = () => { isDragging.current = false; };
    
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
  }, []);

  // Determine images to render
  const isCompare = compareIds.length === 2;
  const activeStep = timelineSteps.find(s => s.id === activeStepId);
  const leftItem = isCompare ? timelineSteps.find(s => s.id === compareIds[0]) : null;
  const rightItem = isCompare ? timelineSteps.find(s => s.id === compareIds[1]) : null;

  const handleCopyPrompt = () => {
    if (preview.prompt) {
      navigator.clipboard.writeText(preview.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleExportImage = () => {
    const imageUrl = activeStep?.image || preview.outputImage || '';
    if (imageUrl) {
      onOpenExport(imageUrl, preview.label);
    }
  };

  const handleSendSingle = () => {
    if (activeStep) {
      onSendToCanvas(activeStep.image);
    }
  };

  const handleSendGroup = () => {
    if (compareIds.length > 0) {
      const urls = timelineSteps
        .filter(s => compareIds.includes(s.id))
        .map(s => s.image);
      onSendGroupToCanvas(urls);
    }
  };

  return (
    <div className="history-overlay">
      <div className="modal-backdrop-close" onClick={onClose} />

      {/* Floating navigation chevrons */}
      {hasPrev && (
        <button className="modal-nav-btn prev" onClick={e => { e.stopPropagation(); onNavigate('prev'); }} title="Previous (←)">
          <ChevronLeft size={22} />
        </button>
      )}
      {hasNext && (
        <button className="modal-nav-btn next" onClick={e => { e.stopPropagation(); onNavigate('next'); }} title="Next (→)">
          <ChevronRight size={22} />
        </button>
      )}

      <div className="history-modal expanded-history-modal">
        <button className="modal-close" onClick={onClose}><X size={18} /></button>
        
        <div className="modal-tabs">
          <div className="modal-tab active">
            <Eye size={13} />
            <span>{isCompare ? 'Side-by-Side Compare' : 'Image Viewer'}</span>
          </div>
        </div>

        {/* Dynamic Image Preview Area */}
        <div className="modal-image-area">
          {isLoading ? (
            <div className="modal-image-skeleton">
              <div className="skeleton-shimmer" style={{ width: '100%', height: '100%', borderRadius: 8 }} />
            </div>
          ) : isCompare && leftItem && rightItem ? (
            // Before/After comparison slider
            <button
              className="compare-slider"
              ref={sliderRef}
              onMouseDown={handleSliderDown}
              aria-label="Compare images slider"
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'ew-resize' }}
            >
              <img src={rightItem.image} alt="After" className="compare-img after" draggable={false} />
              <div className="compare-clip" style={{ width: `${sliderPos}%` }}>
                <img
                  src={leftItem.image}
                  alt="Before"
                  className="compare-img"
                  draggable={false}
                  style={{ width: sliderRef.current ? `${sliderRef.current.offsetWidth}px` : '100%' }}
                />
              </div>
              <div className="compare-handle" style={{ left: `${sliderPos}%` }}>
                <div className="compare-handle-line" />
                <div className="compare-handle-knob">
                  <ChevronsLeftRight size={12} color="#999" />
                </div>
              </div>
              <span className="compare-label left">{leftItem.processingType}</span>
              <span className="compare-label right">{rightItem.processingType}</span>
            </button>
          ) : (
            // Single image rendering
            <img 
              src={activeStep?.image || ''} 
              alt={preview.label} 
              className="modal-preview-img" 
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iIzIyMiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjE4IiBmaWxsPSIjNjY2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+SW1hZ2Ugbm90IGF2YWlsYWJsZTwvdGV4dD48L3N2Zz4=';
              }}
            />
          )}
        </div>

        {/* Workflow Evolution Timeline Panel */}
        {!isLoading && timelineSteps.length > 0 && (
          <WorkflowTimeline
            steps={timelineSteps}
            activeStepId={activeStepId}
            onStepSelect={setActiveStepId}
            compareIds={compareIds}
            onCompareToggle={toggleCompareId}
            zoomLevel={zoomLevel}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onZoomReset={handleZoomReset}
          />
        )}

        {/* Image Metadata Info */}
        <div className="modal-info">
          <div className="modal-info-row">
            <h3>{preview.label}</h3>
            <div className="modal-meta">
              <span className="meta-chip type">{preview.type}</span>
              {preview.model && <span className="meta-chip model">{preview.model}</span>}
              {preview.duration && <span className="meta-chip">{formatDuration(preview.duration)}</span>}
              <span className="meta-chip">{formatTime(preview.timestamp)}</span>
            </div>
          </div>

          {preview.prompt && (
            <div className="modal-prompt">
              <p>{preview.prompt}</p>
              <div className="prompt-actions">
                <button className={`prompt-btn ${copied ? 'feedback' : ''}`} onClick={handleCopyPrompt}>
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copied ? 'Copied!' : 'Copy Prompt'}</span>
                </button>
                <button className="prompt-btn" onClick={() => onReusePrompt(preview.prompt!, preview.id)}>
                  <RotateCcw size={12} />
                  <span>Reuse Prompt</span>
                </button>
              </div>
            </div>
          )}

          <div className="modal-actions">
            {compareIds.length === 0 && activeStep && (
              <button className="modal-action-btn canvas-btn" onClick={handleSendSingle}>
                <FolderOpen size={13} />
                <span>Send to Canvas</span>
              </button>
            )}
            
            {compareIds.length > 0 && (
              <button className="modal-action-btn canvas-btn" onClick={handleSendGroup}>
                <FolderOpen size={13} />
                <span>Send Comparison ({compareIds.length})</span>
              </button>
            )}

            <button className="modal-action-btn canvas-btn" onClick={() => onOpenWorkflow(preview)}>
              <Sliders size={13} />
              <span>Load Full Workflow</span>
            </button>

            <button className="modal-action-btn save-btn" onClick={handleExportImage}>
              <Save size={13} />
              <span>Export Image</span>
            </button>

            <button 
              className={`modal-star ${preview.starred ? 'active' : ''}`}
              onClick={(e) => onStar(e, preview.id)}
            >
              <Star size={13} fill={preview.starred ? '#e11d48' : 'none'} />
              <span>{preview.starred ? 'Starred' : 'Star'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
