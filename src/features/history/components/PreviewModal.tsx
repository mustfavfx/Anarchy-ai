import React, { useState, useEffect, useRef } from 'react';
import type { HistoryEntry, NodeTreeData } from '../types';
import { 
  loadFullImage, 
  formatTime, 
  formatDuration,
  revokeObjectUrl
} from '@/services/history/HistoryService';
import { useHistoryStore } from '@/stores/historyStore';
import { useWorkflowTimeline } from '../hooks/useWorkflowTimeline';
import { useLazyImage } from '../hooks/useLazyImage';
import { buildWorkflowTreeForEntry } from './WorkflowTreeRenderer';
import { WorkflowTimeline } from './WorkflowTimeline';
import { buildWorkflowTimeline } from '@/services/history/WorkflowTimelineService';
import { loadWorkflowTree } from '@/services/history/HistoryService';
import { WorkflowGraphExplorer } from './WorkflowGraphExplorer';
import { 
  X, Copy, RotateCcw, FolderOpen, Save, Star, 
  ChevronLeft, ChevronRight, Eye, Check, Sliders, ChevronsLeftRight, GitBranch,
  Image as ImageIcon, Sparkles
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
  onSendToCanvas: (url: string, entry: HistoryEntry) => void;
  onSendGroupToCanvas: (urls: string[]) => void;
  onReusePrompt: (prompt: string, id: string) => void;
  onPreviewChange?: (entry: HistoryEntry) => void;
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
  onReusePrompt,
  onPreviewChange
}) => {
  const { entries: allEntries } = useHistoryStore();
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'tree' | 'timeline' | 'provenance'>('tree');
  const [timelineSteps, setTimelineSteps] = useState<any[]>([]);
  const [activeImage, setActiveImage] = useState<string>('');

  // Keep track of Blob URLs created during this modal's lifetime to revoke them and free RAM
  const createdUrlsRef = useRef<Set<string>>(new Set());

  // Helper to load full images and track their URLs for cleanup
  const loadFullImageTracked = async (id: string, slot: 'output' | 'input' | 'root_source') => {
    const url = await loadFullImage(id, slot);
    if (url && url.startsWith('blob:')) {
      createdUrlsRef.current.add(url);
    }
    return url;
  };

  // Cleanup all tracked Blob URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      createdUrlsRef.current.forEach(url => {
        try {
          revokeObjectUrl(url);
        } catch (e) {
          console.warn('[PreviewModal] Failed to revoke object URL:', url, e);
        }
      });
      createdUrlsRef.current.clear();
    };
  }, []);

  // Load timeline steps and active image concurrently when preview changes (utilizing Zustand global cache)
  useEffect(() => {
    let active = true;

    const fetchWorkflowData = async () => {
      try {
        // Resolve output image URL
        const outputUrl = await loadFullImageTracked(preview.id, 'output');

        // Resolve workflow tree (read from Zustand cache or load from IndexedDB)
        let nodeTree: NodeTreeData | null = useHistoryStore.getState().workflowCache[preview.id] || null;
        if (!nodeTree) {
          nodeTree = await loadWorkflowTree(preview.id) || preview.nodeTree || null;
          if (nodeTree) {
            useHistoryStore.setState((state) => ({
              workflowCache: { ...state.workflowCache, [preview.id]: nodeTree as NodeTreeData }
            }));
          }
        }

        // Resolve timeline steps (read from Zustand cache or build)
        let steps = useHistoryStore.getState().timelineCache[preview.id];
        if (!steps) {
          steps = await buildWorkflowTimeline(
            preview,
            nodeTree,
            null, // skip inputUrl since timeline now lazy loads step thumbnails
            outputUrl
          );
          if (steps) {
            useHistoryStore.setState((state) => ({
              timelineCache: { ...state.timelineCache, [preview.id]: steps }
            }));
          }
        }

        if (active) {
          setTimelineSteps(steps || []);
          setActiveImage(outputUrl || '');
        }
      } catch (err) {
        logger.error('[PreviewModal] Failed to load workflow data:', err);
      }
    };

    fetchWorkflowData();
    return () => {
      active = false;
    };
  }, [preview.id]);

  // Slider states
  const [sliderPos, setSliderPos] = useState(50);
  const [compareMode, setCompareMode] = useState<'slider' | 'grid'>('slider');
  const sliderRef = useRef<HTMLButtonElement | null>(null);
  const isDragging = useRef(false);

  // Zoom and selection states
  const {
    zoomLevel,
    compareIds,
    toggleCompareId,
    clearCompare,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset
  } = useWorkflowTimeline();

  // Load comparison images
  const [compareImages, setCompareImages] = useState<{ [id: string]: string }>({});
  useEffect(() => {
    if (compareIds.length === 2) {
      let active = true;
      const loadComp = async () => {
        try {
          const leftImg = await loadFullImageTracked(compareIds[0], 'output');
          const rightImg = await loadFullImageTracked(compareIds[1], 'output');
          if (active) {
            setCompareImages({
              [compareIds[0]]: leftImg || '',
              [compareIds[1]]: rightImg || '',
            });
          }
        } catch (err) {
          logger.error('[PreviewModal] Failed to load comparison images:', err);
        }
      };
      loadComp();
      return () => { active = false; };
    } else {
      setCompareImages({});
    }
  }, [compareIds]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && hasNext) { e.preventDefault(); onNavigate('next'); }
      if (e.key === 'ArrowLeft' && hasPrev) { e.preventDefault(); onNavigate('prev'); }
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [hasPrev, hasNext, onNavigate, onClose]);

  // Reset comparison on navigation
  useEffect(() => {
    clearCompare();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview.id]);

  // Slider dragging handlers
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

  const handleCopyPrompt = () => {
    if (preview.prompt) {
      navigator.clipboard.writeText(preview.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleExportImage = () => {
    if (activeImage) {
      onOpenExport(activeImage, preview.label);
    }
  };

  const handleSendSingle = () => {
    if (activeImage) {
      onSendToCanvas(activeImage, preview);
    }
  };

  const handleSendGroup = () => {
    if (compareIds.length === 2 && compareImages[compareIds[0]] && compareImages[compareIds[1]]) {
      onSendGroupToCanvas([compareImages[compareIds[0]], compareImages[compareIds[1]]]);
    }
  };

  // Build tree to resolve lineage path
  const { activePath } = buildWorkflowTreeForEntry(preview, allEntries);

  // Compute Branch Analytics and AI Memory details
  const workflowRootId = preview.rootId || preview.rootSourceId || preview.id;
  const familyEntries = allEntries.filter(e => 
    e.id === workflowRootId || 
    e.rootId === workflowRootId || 
    e.rootSourceId === workflowRootId
  );

  const totalVariations = familyEntries.filter(e => e.nodeType === 'variation' || e.type === 'variation').length;
  const totalUpscales = familyEntries.filter(e => e.nodeType === 'upscale' || e.type === 'upscale').length;
  const totalEdits = familyEntries.filter(e => e.nodeType === 'edit' || e.type === 'edit' || e.nodeType === 'canvas').length;

  // Most Reused Branch: find parent entry with most children in familyEntries
  let mostReusedBranchLabel = 'None';
  let maxChildren = 0;
  familyEntries.forEach(parent => {
    const childrenCount = familyEntries.filter(child => child.parentId === parent.id).length;
    if (childrenCount > maxChildren) {
      maxChildren = childrenCount;
      const typeLabel = 
        parent.nodeType === 'source' ? 'Original' :
        parent.nodeType === 'upscale' ? 'Upscale' :
        parent.nodeType === 'variation' ? 'Variation' :
        parent.nodeType === 'edit' ? 'Edit' : 'Canvas';
      mostReusedBranchLabel = `${typeLabel} (reused ${childrenCount}x)`;
    }
  });

  // Semantic similarity mapping
  const getSemanticMatches = () => {
    if (!preview.prompt) return { count: 0 };
    const stopWords = new Set(['a', 'an', 'the', 'in', 'on', 'of', 'and', 'to', 'with', 'by', 'for', 'at', 'from', 'as', 'is', 'it', 'that', 'this', 'or', 'but']);
    const currentWords = preview.prompt.toLowerCase().split(/\s+/).map(w => w.replace(/[^a-z0-9]/g, '')).filter(w => w.length > 3 && !stopWords.has(w));
    
    if (currentWords.length === 0) return { count: 0 };

    let matchesCount = 0;
    allEntries.forEach(entry => {
      if (entry.id === preview.id) return;
      if (!entry.prompt) return;
      const words = entry.prompt.toLowerCase().split(/\s+/).map(w => w.replace(/[^a-z0-9]/g, '')).filter(w => w.length > 3 && !stopWords.has(w));
      const overlap = currentWords.filter(w => words.includes(w));
      if (overlap.length >= 2 || (overlap.length > 0 && overlap.length / currentWords.length >= 0.4)) {
        matchesCount++;
      }
    });
    return { count: matchesCount };
  };

  const semanticInfo = getSemanticMatches();

  const isCompare = compareIds.length === 2;
  const leftItemImage = isCompare ? compareImages[compareIds[0]] : null;
  const rightItemImage = isCompare ? compareImages[compareIds[1]] : null;
  
  // Resolve labels for comparison slider
  const leftItemEntry = isCompare ? allEntries.find(e => e.id === compareIds[0]) : null;
  const rightItemEntry = isCompare ? allEntries.find(e => e.id === compareIds[1]) : null;
  const leftLabel = leftItemEntry ? (leftItemEntry.nodeType || leftItemEntry.type).toUpperCase() : 'BEFORE';
  const rightLabel = rightItemEntry ? (rightItemEntry.nodeType || rightItemEntry.type).toUpperCase() : 'AFTER';

  const renderBreadcrumbs = () => {
    if (activePath.length <= 1) return null;
    return (
      <div className="workflow-breadcrumbs">
        {activePath.map((id, index) => {
          const entry = allEntries.find(e => e.id === id);
          if (!entry) return null;
          const isLast = index === activePath.length - 1;
          const typeLabel = 
            entry.nodeType === 'source' ? 'Original' :
            entry.nodeType === 'upscale' ? 'Upscale' :
            entry.nodeType === 'variation' ? 'Variation' :
            entry.nodeType === 'edit' ? 'Edit' : 'Canvas';
          return (
            <React.Fragment key={id}>
              {index > 0 && <ChevronRight size={10} className="breadcrumb-separator" />}
              <button 
                className={`breadcrumb-item ${isLast ? 'active' : ''}`}
                disabled={isLast}
                onClick={() => onPreviewChange?.(entry)}
              >
                {typeLabel}
              </button>
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  return (
    <div className="history-overlay">
      <div className="modal-backdrop-close" onClick={onClose} />

      {/* Navigation chevrons (chronological navigate) */}
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

        <div className="modal-split-container">
          <div className="modal-left-pane">
            {/* Image Preview Area */}
            <div className="modal-image-area">
              {!activeImage ? (
                <div className="modal-image-skeleton">
                  <div className="skeleton-shimmer" style={{ width: '100%', height: '100%', borderRadius: 8 }} />
                </div>
              ) : isCompare && leftItemImage && rightItemImage ? (
                <>
                  {/* Compare mode selector overlay */}
                  <div className="compare-mode-toggle" style={{ display: 'flex', gap: '4px', position: 'absolute', top: '12px', left: '12px', zIndex: 100, background: 'rgba(10,10,10,0.7)', padding: '3px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(4px)' }}>
                    <button
                      className={`compare-toggle-btn ${compareMode === 'slider' ? 'active' : ''}`}
                      onClick={(e) => { e.stopPropagation(); setCompareMode('slider'); }}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 600,
                        background: compareMode === 'slider' ? '#e11d48' : 'transparent',
                        color: '#fff',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      Slider
                    </button>
                    <button
                      className={`compare-toggle-btn ${compareMode === 'grid' ? 'active' : ''}`}
                      onClick={(e) => { e.stopPropagation(); setCompareMode('grid'); }}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 600,
                        background: compareMode === 'grid' ? '#e11d48' : 'transparent',
                        color: '#fff',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      Side-by-Side
                    </button>
                  </div>

                  {compareMode === 'slider' ? (
                    // Before/After comparison slider
                    <button
                      className="compare-slider"
                      ref={sliderRef}
                      onMouseDown={handleSliderDown}
                      aria-label="Compare images slider"
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'ew-resize' }}
                    >
                      <img src={rightItemImage} alt="After" className="compare-img after" draggable={false} />
                      <div className="compare-clip" style={{ width: `${sliderPos}%` }}>
                        <img
                          src={leftItemImage}
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
                      <span className="compare-label left">{leftLabel}</span>
                      <span className="compare-label right">{rightLabel}</span>
                    </button>
                  ) : (
                    // Side-by-side grid
                    <div className="compare-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', width: '100%', height: '100%', padding: '16px', boxSizing: 'border-box' }}>
                      <div className="compare-grid-item" style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)', overflow: 'hidden', height: '100%' }}>
                        <img src={leftItemImage} alt="Left Item" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                        <span className="compare-label" style={{ position: 'absolute', bottom: '8px', left: '8px', background: 'rgba(10,10,10,0.7)', padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 600, color: '#fda4af', border: '1px solid rgba(225,29,72,0.2)' }}>{leftLabel}</span>
                      </div>
                      <div className="compare-grid-item" style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)', overflow: 'hidden', height: '100%' }}>
                        <img src={rightItemImage} alt="Right Item" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                        <span className="compare-label" style={{ position: 'absolute', bottom: '8px', left: '8px', background: 'rgba(10,10,10,0.7)', padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 600, color: '#38bdf8', border: '1px solid rgba(56,189,248,0.2)' }}>{rightLabel}</span>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                // Single image view
                <img 
                  src={activeImage} 
                  alt={preview.label} 
                  className="modal-preview-img" 
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iIzIyMiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjE4IiBmaWxsPSIjNjY2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+SW1hZ2Ugbm90IGF2YWlsYWJsZTwvdGV4dD48L3N2Zz4=';
                  }}
                />
              )}
            </div>

            {/* View Mode Toggle */}
            <div className="workflow-view-selector" style={{ display: 'flex', gap: '8px', margin: '8px 12px', zIndex: 10 }}>
              <button 
                className={`view-selector-btn ${viewMode === 'tree' ? 'active' : ''}`}
                onClick={() => setViewMode('tree')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 600,
                  background: viewMode === 'tree' ? 'rgba(225, 29, 72, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                  border: `1px solid ${viewMode === 'tree' ? '#e11d48' : 'rgba(255, 255, 255, 0.08)'}`,
                  color: viewMode === 'tree' ? '#fda4af' : 'rgba(255,255,255,0.6)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  transition: 'all 0.2s ease'
                }}
              >
                <GitBranch size={12} />
                <span>Tree View</span>
              </button>
              <button 
                className={`view-selector-btn ${viewMode === 'timeline' ? 'active' : ''}`}
                onClick={() => setViewMode('timeline')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 600,
                  background: viewMode === 'timeline' ? 'rgba(225, 29, 72, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                  border: `1px solid ${viewMode === 'timeline' ? '#e11d48' : 'rgba(255, 255, 255, 0.08)'}`,
                  color: viewMode === 'timeline' ? '#fda4af' : 'rgba(255,255,255,0.6)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  transition: 'all 0.2s ease'
                }}
              >
                <Sliders size={12} />
                <span>Timeline View</span>
              </button>
              <button 
                className={`view-selector-btn ${viewMode === 'provenance' ? 'active' : ''}`}
                onClick={() => setViewMode('provenance')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 600,
                  background: viewMode === 'provenance' ? 'rgba(225, 29, 72, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                  border: `1px solid ${viewMode === 'provenance' ? '#e11d48' : 'rgba(255, 255, 255, 0.08)'}`,
                  color: viewMode === 'provenance' ? '#fda4af' : 'rgba(255,255,255,0.6)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  transition: 'all 0.2s ease'
                }}
              >
                <GitBranch size={12} />
                <span>Lineage View</span>
              </button>
            </div>

            {/* Workflow evolution mindmap-like tree */}
            <div className="modal-timeline" style={{ display: 'flex', flexDirection: 'column', height: viewMode === 'provenance' ? 'auto' : undefined }}>
              {viewMode === 'tree' ? (
                <WorkflowGraphExplorer
                  preview={preview}
                  onNodeSelect={(entry) => onPreviewChange?.(entry)}
                  compareIds={compareIds}
                  onCompareToggle={toggleCompareId}
                />
              ) : viewMode === 'timeline' ? (
                <WorkflowTimeline
                  steps={timelineSteps}
                  activeStepId={timelineSteps.find(step => step.id === preview.id || step.id === (preview.nodeTree?.activeNodeId || preview.nodeTree?.nodes.find(n => n.historyEntryId === preview.id)?.id))?.id || preview.id}
                  onStepSelect={(stepId) => {
                    const entry = allEntries.find(e => 
                      e.id === stepId || 
                      e.nodeTree?.activeNodeId === stepId || 
                      e.nodeTree?.nodes.some(n => n.id === stepId && n.historyEntryId === e.id)
                    );
                    if (entry) {
                      onPreviewChange?.(entry);
                    }
                  }}
                  compareIds={compareIds}
                  onCompareToggle={toggleCompareId}
                  zoomLevel={zoomLevel}
                  onZoomIn={handleZoomIn}
                  onZoomOut={handleZoomOut}
                  onZoomReset={handleZoomReset}
                />
              ) : (
                <ProvenanceTimeline
                  activePath={activePath}
                  activeId={preview.id}
                  onSelect={(entry) => onPreviewChange?.(entry)}
                />
              )}
            </div>
          </div>

          <div className="modal-right-pane">
            {isCompare && leftItemEntry && rightItemEntry ? (
              // Side-by-side comparison metadata
              <div className="modal-info compare-metadata-container">
                <div className="compare-metadata-header">
                  <h3 style={{ margin: 0, fontSize: '15px', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ChevronsLeftRight size={16} />
                    <span>Compare Sibling Branches</span>
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)' }}>
                    Highlighting differences between {leftLabel} and {rightLabel}
                  </p>
                </div>
                
                <div className="compare-metadata-columns">
                  {/* Left Column (Left Node) */}
                  <div className={`compare-column ${preview.id === leftItemEntry.id ? 'active-target' : ''}`}>
                    <div className="compare-column-title left">
                      <span>{leftLabel} (Left)</span>
                    </div>
                                     <div className="compare-param-row">
                      <span className="compare-param-label">Model</span>
                      <span className={`compare-param-value ${leftItemEntry.model !== rightItemEntry.model ? 'differs' : ''}`}>
                        {leftItemEntry.model ? leftItemEntry.model.split('/').pop() : 'Unknown'}
                      </span>
                    </div>

                    <div className="compare-param-row">
                      <span className="compare-param-label">Prompt</span>
                      <span className={`compare-param-value ${leftItemEntry.prompt !== rightItemEntry.prompt ? 'differs' : ''}`} style={{ maxHeight: '100px', overflowY: 'auto' }}>
                        {leftItemEntry.prompt || '(none)'}
                      </span>
                    </div>

                    <div className="compare-param-row">
                      <span className="compare-param-label">Seed</span>
                      <span className={`compare-param-value ${leftItemEntry.params?.seed !== rightItemEntry.params?.seed ? 'differs' : ''}`}>
                        {leftItemEntry.params?.seed !== undefined ? String(leftItemEntry.params.seed) : 'Auto'}
                      </span>
                    </div>

                    <div className="compare-param-row">
                      <span className="compare-param-label">CFG Scale</span>
                      <span className={`compare-param-value ${leftItemEntry.params?.cfg !== rightItemEntry.params?.cfg ? 'differs' : ''}`}>
                        {leftItemEntry.params?.cfg ?? 'Auto'}
                      </span>
                    </div>

                    <div className="compare-param-row">
                      <span className="compare-param-label">Steps</span>
                      <span className={`compare-param-value ${leftItemEntry.params?.steps !== rightItemEntry.params?.steps ? 'differs' : ''}`}>
                        {leftItemEntry.params?.steps ?? 'Auto'}
                      </span>
                    </div>

                    <div className="compare-param-row">
                      <span className="compare-param-label">Strength</span>
                      <span className={`compare-param-value ${leftItemEntry.params?.strength !== rightItemEntry.params?.strength ? 'differs' : ''}`}>
                        {leftItemEntry.params?.strength ?? 'Auto'}
                      </span>
                    </div>

                    <div className="compare-param-row">
                      <span className="compare-param-label">Duration</span>
                      <span className="compare-param-value">
                        {leftItemEntry.duration ? formatDuration(leftItemEntry.duration) : 'N/A'}
                      </span>
                    </div>
                  </div>

                  {/* Right Column (Right Node) */}
                  <div className={`compare-column ${preview.id === rightItemEntry.id ? 'active-target' : ''}`}>
                    <div className="compare-column-title right">
                      <span>{rightLabel} (Right)</span>
                    </div>
                    
                    <div className="compare-param-row">
                      <span className="compare-param-label">Model</span>
                      <span className={`compare-param-value ${leftItemEntry.model !== rightItemEntry.model ? 'differs' : ''}`}>
                        {rightItemEntry.model ? rightItemEntry.model.split('/').pop() : 'Unknown'}
                      </span>
                    </div>

                    <div className="compare-param-row">
                      <span className="compare-param-label">Prompt</span>
                      <span className={`compare-param-value ${leftItemEntry.prompt !== rightItemEntry.prompt ? 'differs' : ''}`} style={{ maxHeight: '100px', overflowY: 'auto' }}>
                        {rightItemEntry.prompt || '(none)'}
                      </span>
                    </div>

                    <div className="compare-param-row">
                      <span className="compare-param-label">Seed</span>
                      <span className={`compare-param-value ${leftItemEntry.params?.seed !== rightItemEntry.params?.seed ? 'differs' : ''}`}>
                        {rightItemEntry.params?.seed !== undefined ? String(rightItemEntry.params.seed) : 'Auto'}
                      </span>
                    </div>

                    <div className="compare-param-row">
                      <span className="compare-param-label">CFG Scale</span>
                      <span className={`compare-param-value ${leftItemEntry.params?.cfg !== rightItemEntry.params?.cfg ? 'differs' : ''}`}>
                        {rightItemEntry.params?.cfg ?? 'Auto'}
                      </span>
                    </div>

                    <div className="compare-param-row">
                      <span className="compare-param-label">Steps</span>
                      <span className={`compare-param-value ${leftItemEntry.params?.steps !== rightItemEntry.params?.steps ? 'differs' : ''}`}>
                        {rightItemEntry.params?.steps ?? 'Auto'}
                      </span>
                    </div>

                    <div className="compare-param-row">
                      <span className="compare-param-label">Strength</span>
                      <span className={`compare-param-value ${leftItemEntry.params?.strength !== rightItemEntry.params?.strength ? 'differs' : ''}`}>
                        {rightItemEntry.params?.strength ?? 'Auto'}
                      </span>
                    </div>

                    <div className="compare-param-row">
                      <span className="compare-param-label">Duration</span>
                      <span className="compare-param-value">
                        {rightItemEntry.duration ? formatDuration(rightItemEntry.duration) : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="compare-metadata-actions" style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                  <button className="modal-action-btn canvas-btn" onClick={handleSendGroup} style={{ flex: 1 }}>
                    <FolderOpen size={13} />
                    <span>Send Comparison ({compareIds.length})</span>
                  </button>
                  <button 
                    className="modal-action-btn" 
                    onClick={clearCompare} 
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: 'rgba(255,255,255,0.6)',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>
            ) : (
              // Normal single image info
              <div className="modal-info">
                {/* Clickable Breadcrumbs Trail */}
                {renderBreadcrumbs()}

                <div className="modal-info-row">
                  <h3>{preview.label}</h3>
                  <div className="modal-meta">
                    <span className="meta-chip type">{preview.nodeType || preview.type}</span>
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

                {/* Branch Analytics & AI Project Memory Insights Card */}
                <div className="ai-memory-insights-card" style={{
                  marginTop: '16px',
                  marginBottom: '16px',
                  padding: '14px',
                  background: 'rgba(30, 30, 35, 0.4)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  backdropFilter: 'blur(10px)'
                }}>
                  {/* Branch Analytics Section */}
                  <div>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '11px', fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <GitBranch size={12} />
                      <span>Branch Analytics</span>
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Total Variations:</span>
                        <span style={{ fontWeight: 600, color: '#fff' }}>{totalVariations}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Upscales:</span>
                        <span style={{ fontWeight: 600, color: '#fff' }}>{totalUpscales}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Edits:</span>
                        <span style={{ fontWeight: 600, color: '#fff' }}>{totalEdits}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Reused Branch:</span>
                        <span style={{ fontWeight: 600, color: '#fda4af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80px' }} title={mostReusedBranchLabel}>{mostReusedBranchLabel}</span>
                      </div>
                    </div>
                  </div>

                  {/* AI Project Memory Layer */}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '11px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Sparkles size={12} />
                      <span>AI Project Memory</span>
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Origin Workflow:</span>
                        <span style={{ fontWeight: 600, color: '#fff' }}>
                          {(() => {
                            const rootNode = allEntries.find(e => e.id === workflowRootId);
                            return rootNode ? (rootNode.label || `Workflow #${workflowRootId.substring(0, 4)}`) : 'Unknown';
                          })()}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Derived From:</span>
                        <span style={{ fontWeight: 600, color: '#fff' }}>{preview.project || 'Project X'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Similar Images:</span>
                        <span style={{ fontWeight: 600, color: '#fbbf24' }}>{semanticInfo.count} similar images</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="modal-actions">
                  {compareIds.length === 0 && activeImage && (
                    <button className="modal-action-btn canvas-btn" onClick={handleSendSingle}>
                      <FolderOpen size={13} />
                      <span>Send to Canvas</span>
                    </button>
                  )}
                  
                  {compareIds.length === 2 && (
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
                    <Star size={13} fill={preview.starred ? '#fbbf24' : 'none'} stroke={preview.starred ? '#fbbf24' : 'currentColor'} />
                    <span>{preview.starred ? 'Starred' : 'Star Image'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Provenance engine lineage components ──────────────────────────────────────

const ProvenanceNodeCard: React.FC<{
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
  
  // Params extraction
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

interface ProvenanceTimelineProps {
  activePath: string[];
  activeId: string;
  onSelect: (entry: HistoryEntry) => void;
}

const ProvenanceTimeline: React.FC<ProvenanceTimelineProps> = ({ activePath, activeId, onSelect }) => {
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
