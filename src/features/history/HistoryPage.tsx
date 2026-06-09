import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { logger } from '../../utils/logger';
import { useNavigate } from 'react-router-dom';
import {
  Search, Clock, Star, Save, X,
  Eye, Copy, Zap, Image as ImageIcon,
  Timer, ArrowUpDown, RotateCcw, StarOff, Trash2,
  FolderOpen, Check, CheckSquare, Square, Download, FileDown,
  ChevronsLeftRight, BookmarkPlus, BookOpen,
  Plus, FolderHeart, ChevronLeft, ChevronRight,
} from 'lucide-react';
import {
  getHistory, getHistoryStats, toggleStar,
  deleteHistoryEntry, clearHistory, formatTime, formatDuration,
  loadFullImage, deleteFullImages, loadWorkflowTree, getDateLabel,
  getLocalImage, type HistoryEntry
} from '../../services/history/HistoryService';
import { CollectionService, type Collection } from '../../services/history/CollectionService';
import { useLazyImage } from '../../hooks';
import { ConfirmModal } from '../../components/ConfirmModal';
import { ExportModal } from '../../components/ExportModal';
import { exportImagesToPDF } from '../../utils/pdfExport';
import { STORAGE_KEYS, SESSION_KEYS } from '../../utils/storageKeys';
import './HistoryPage.css';

/* ════════════════════════════════════════════════════════════════════
   TYPES
   ════════════════════════════════════════════════════════════════════ */
type FilterType = 'all' | 'render' | 'upscale' | 'variation' | 'edit' | 'generate' | 'starred' | 'pinboard';

/* ── Date grouping ── */
const shouldKeepEntry = (entry: HistoryEntry, filter: string, search: string, collections: Collection[], activePinboardId: string | null, selectedModel?: string): boolean => {
  if (selectedModel && selectedModel !== 'all' && entry.model !== selectedModel) return false;
  if (filter === 'starred' && !entry.starred) return false;
  if (filter === 'pinboard') {
    if (!activePinboardId) return false;
    const col = collections.find(c => c.id === activePinboardId);
    if (!col || !col.entryIds.includes(entry.id)) return false;
  } else if (filter !== 'all' && filter !== 'starred' && entry.type !== filter) {
    return false;
  }
  if (search) {
    const q = search.toLowerCase();
    const matches = (
      entry.label.toLowerCase().includes(q) ||
      (entry.prompt?.toLowerCase().includes(q)) ||
      (entry.project?.toLowerCase().includes(q)) ||
      (entry.model?.toLowerCase().includes(q))
    );
    if (!matches) return false;
  }
  return true;
};

function groupEntriesByDate(entries: HistoryEntry[]): { label: string; entries: HistoryEntry[] }[] {
  const groups: { label: string; entries: HistoryEntry[] }[] = [];
  let currentLabel = '';
  for (const entry of entries) {
    const label = getDateLabel(entry.timestamp);
    if (label !== currentLabel) {
      currentLabel = label;
      groups.push({ label, entries: [] });
    }
    groups[groups.length - 1].entries.push(entry);
  }
  return groups;
}

/* ════════════════════════════════════════════════════════════════════
   STATS ROW
   ════════════════════════════════════════════════════════════════════ */
const StatsRow: React.FC<{ stats: any }> = ({ stats }) => {
  if (stats.total === 0) return null;
  return (
    <div className="history-stats">
      <div className="hstat"><Zap size={14} className="hstat-icon" /><span className="hstat-val">{stats.total}</span><span className="hstat-label">Total</span></div>
      <div className="hstat"><Clock size={14} className="hstat-icon" /><span className="hstat-val">{stats.todayCount}</span><span className="hstat-label">Today</span></div>
      <div className="hstat"><Star size={14} className="hstat-icon" /><span className="hstat-val">{stats.starred}</span><span className="hstat-label">Starred</span></div>
      <div className="hstat"><Timer size={14} className="hstat-icon" /><span className="hstat-val">{stats.totalDuration > 0 ? formatDuration(stats.totalDuration) : '—'}</span><span className="hstat-label">Total Time</span></div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════════
   BULK ACTION BAR
   ════════════════════════════════════════════════════════════════════ */
const BulkActionBar: React.FC<{
  selectMode: boolean;
  selectedCount: number;
  totalCount: number;
  toggleSelectAll: () => void;
  handleBulkExport: () => void;
  onDeleteClick: () => void;
}> = ({ selectMode, selectedCount, totalCount, toggleSelectAll, handleBulkExport, onDeleteClick }) => {
  if (!selectMode) return null;
  return (
    <div className="bulk-action-bar">
      <button className="bulk-select-all" onClick={toggleSelectAll}>
        {selectedCount === totalCount ? <><CheckSquare size={14} /> Deselect All</> : <><Square size={14} /> Select All</>}
      </button>
      <span className="bulk-count">{selectedCount} selected</span>
      <div className="bulk-actions">
        <button className="bulk-btn" onClick={handleBulkExport} disabled={selectedCount === 0}><Download size={14} /> Export</button>
        <button className="bulk-btn danger" onClick={onDeleteClick} disabled={selectedCount === 0}><Trash2 size={14} /> Delete ({selectedCount})</button>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════════
   DATE GROUP HEADER
   ════════════════════════════════════════════════════════════════════ */
const DateGroupHeader: React.FC<{ label: string; count: number }> = ({ label, count }) => (
  <div className="history-date-header">
    <span className="history-date-label">{label}</span>
    <div className="history-date-line" />
    <span className="history-date-count">{count}</span>
  </div>
);

/* ════════════════════════════════════════════════════════════════════
   ADD TO COLLECTION MODAL
   ════════════════════════════════════════════════════════════════════ */
const AddToCollectionModal: React.FC<{
  entryId: string;
  collections: Collection[];
  onAddToNew: (name: string) => void;
  onAddTo: (colId: string) => void;
  onRemoveFrom: (colId: string) => void;
  onClose: () => void;
}> = ({ entryId, collections, onAddToNew, onAddTo, onRemoveFrom, onClose }) => {
  const [newName, setNewName] = useState('');
  const [showNew, setShowNew] = useState(false);

  return (
    <div className="history-overlay" onClick={onClose}>
      <div className="col-modal" onClick={e => e.stopPropagation()}>
        <div className="col-modal-header">
          <FolderHeart size={16} color="#e11d48" />
          <h3>Add to Collection</h3>
          <button className="modal-close" onClick={onClose} style={{ position: 'static', width: 28, height: 28 }}><X size={14} /></button>
        </div>

        <div className="col-list">
          {collections.length === 0 && !showNew && (
            <div className="col-empty">No collections yet. Create one below.</div>
          )}
          {collections.map(col => {
            const isIn = col.entryIds.includes(entryId);
            return (
              <button
                key={col.id}
                className={`col-item ${isIn ? 'col-item-active' : ''}`}
                onClick={() => isIn ? onRemoveFrom(col.id) : onAddTo(col.id)}
              >
                <span className="col-dot" style={{ background: col.color }} />
                <span className="col-name">{col.name}</span>
                <span className="col-count">{col.entryIds.length}</span>
                {isIn && <Check size={13} color="#10b981" />}
              </button>
            );
          })}
        </div>

        {showNew ? (
          <div className="col-new-form">
            <input
              className="col-new-input"
              placeholder="Collection name..."
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && newName.trim()) { onAddToNew(newName.trim()); setNewName(''); setShowNew(false); } }}
              autoFocus
            />
            <button
              className="col-create-btn"
              onClick={() => { if (newName.trim()) { onAddToNew(newName.trim()); setNewName(''); setShowNew(false); } }}
            >
              Create
            </button>
          </div>
        ) : (
          <button className="col-new-btn" onClick={() => setShowNew(true)}>
            <Plus size={13} /> New Collection
          </button>
        )}
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════════
   PINBOARD SIDEBAR
   ════════════════════════════════════════════════════════════════════ */
const PinboardSidebar: React.FC<{
  collections: Collection[];
  activePinboardId: string | null;
  onSelect: (id: string | null) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}> = ({ collections, activePinboardId, onSelect, onDelete, onClose }) => (
  <div className="pinboard-sidebar">
    <div className="pinboard-header">
      <BookOpen size={15} color="#e11d48" />
      <span>Collections</span>
      <button className="modal-close" onClick={onClose} style={{ position: 'static', width: 26, height: 26, marginLeft: 'auto' }}><X size={13} /></button>
    </div>
    <div className="pinboard-list">
      <button
        className={`pinboard-item ${activePinboardId === null ? 'pinboard-item-active' : ''}`}
        onClick={() => onSelect(null)}
      >
        <span className="col-dot" style={{ background: '#666' }} />
        All Collections
      </button>
      {collections.map(col => (
        <div key={col.id} className={`pinboard-item-wrap ${activePinboardId === col.id ? 'pinboard-item-active' : ''}`}>
          <button className="pinboard-item" onClick={() => onSelect(col.id)}>
            <span className="col-dot" style={{ background: col.color }} />
            <span className="pinboard-item-name">{col.name}</span>
            <span className="pinboard-item-count">{col.entryIds.length}</span>
          </button>
          <button className="pinboard-delete" onClick={() => onDelete(col.id)} title="Delete collection">
            <Trash2 size={11} />
          </button>
        </div>
      ))}
      {collections.length === 0 && (
        <div className="col-empty" style={{ padding: '16px 12px' }}>
          No collections yet.<br />Add images using the bookmark icon on cards.
        </div>
      )}
    </div>
  </div>
);

/* ════════════════════════════════════════════════════════════════════
   PREVIEW MODAL
   ════════════════════════════════════════════════════════════════════ */
const PreviewImageArea: React.FC<{
  isCompare: boolean;
  sliderRef: React.RefObject<HTMLButtonElement | null>;
  handleSliderDown: () => void;
  leftImage: string | null;
  rightImage: string | null;
  singleImage: string | null;
  label: string;
  sliderPos: number;
}> = ({ isCompare, sliderRef, handleSliderDown, leftImage, rightImage, singleImage, label, sliderPos }) => {
  if (isCompare && leftImage && rightImage) {
    return (
      <button
        className="compare-slider"
        ref={sliderRef}
        onMouseDown={handleSliderDown}
        aria-label="Compare images slider"
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'ew-resize' }}
      >
        <img src={rightImage} alt="After" className="compare-img after" draggable={false} />
        <div className="compare-clip" style={{ width: `${sliderPos}%` }}>
          <img
            src={leftImage}
            alt="Before"
            className="compare-img"
            draggable={false}
            style={{ width: sliderRef.current ? `${sliderRef.current.offsetWidth}px` : '100%' }}
          />
        </div>
        <div className="compare-handle" style={{ left: `${sliderPos}%` }}>
          <div className="compare-handle-line" />
          <div className="compare-handle-knob">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
              <polyline points="9 18 15 12 9 6" transform="translate(0,0) scale(-1,1) translate(-24,0)" />
            </svg>
          </div>
        </div>
        <span className="compare-label left">Before</span>
        <span className="compare-label right">After</span>
      </button>
    );
  }
  return (
    <img src={singleImage || ''} alt={label} className="modal-preview-img"
      onError={(e) => {
        logger.warn('[History] Failed to load modal preview');
        (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iIzIyMiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjE4IiBmaWxsPSIjNjY2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+SW1hZ2Ugbm90IGF2YWlsYWJsZTwvdGV4dD48L3N2Zz4=';
      }}
    />
  );
};

const PreviewModal: React.FC<{
  preview: HistoryEntry;
  fullInput: string | null;
  fullOutput: string | null;
  sliderRef: React.RefObject<HTMLButtonElement | null>;
  handleSliderDown: () => void;
  sliderPos: number;
  copiedId: string | null;
  handleCopyPrompt: (prompt: string, id: string) => void;
  reusedId: string | null;
  handleReusePrompt: (prompt: string, id: string) => void;
  handleOpenWorkflow: (entry: HistoryEntry) => void;
  handleOpenExport: (url: string, name: string) => void;
  handleStar: (e: any, id: string) => void;
  onClose: () => void;
  onNavigate: (dir: 'next' | 'prev') => void;
  hasPrev: boolean;
  hasNext: boolean;
}> = ({
  preview, fullInput, fullOutput,
  sliderRef, handleSliderDown, sliderPos, copiedId, handleCopyPrompt,
  reusedId, handleReusePrompt, handleOpenWorkflow,
  handleOpenExport, handleStar, onClose,
  onNavigate, hasPrev, hasNext,
}) => {
  const navigate = useNavigate();
  const [treeImages, setTreeImages] = useState<Array<{ id: string; image: string; type: string; prompt?: string }>>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [isLoadingTree, setIsLoadingTree] = useState(true);

  // Keyboard navigation inside modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && hasNext) { e.preventDefault(); onNavigate('next'); }
      if (e.key === 'ArrowLeft' && hasPrev) { e.preventDefault(); onNavigate('prev'); }
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [hasPrev, hasNext, onNavigate, onClose]);

  useEffect(() => {
    let active = true;
    // Reset state immediately on navigation to show skeleton
    setIsLoadingTree(true);
    setTreeImages([]);
    setActiveImage(null);
    setSelectedIds([]);

    const loadTree = async () => {
      const workflow = await loadWorkflowTree(preview.id);
      if (!active) return;

      const items: Array<{ id: string; image: string; type: string; prompt?: string }> = [];

      if (workflow && workflow.nodes && workflow.nodes.length > 0) {
        for (const node of workflow.nodes) {
          if (node.image) {
            let imgData = node.image;
            if (imgData.startsWith('idb://')) {
              const cached = await getLocalImage(imgData);
              if (cached) imgData = cached;
            }
            items.push({
              id: node.id,
              image: imgData,
              type: node.type === 'source' ? 'Source' : (node.processingType || 'Render'),
              prompt: node.prompt,
            });
          }
        }
      }

      if (items.length === 0) {
        const outImg = fullOutput || preview.outputImage;
        const inImg = fullInput || preview.inputImage;

        if (inImg) {
          items.push({ id: 'input', image: inImg, type: 'Before', prompt: preview.prompt });
        }
        if (outImg) {
          items.push({ id: 'output', image: outImg, type: 'After', prompt: preview.prompt });
        }
      }

      if (!active) return;
      setTreeImages(items);
      setIsLoadingTree(false);

      if (items.length > 0) {
        const defaultItem = items.find(item => item.id === 'output') || items[items.length - 1];
        setSelectedIds([defaultItem.id]);
        setActiveImage(defaultItem.image);
      }
    };

    loadTree();
    return () => { active = false; };
  }, [preview.id, fullInput, fullOutput]);

  const handleThumbnailClick = (item: typeof treeImages[0]) => {
    setSelectedIds([item.id]);
    setActiveImage(item.image);
  };

  const handleCheckboxClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const isAlreadySelected = prev.includes(id);
      let next: string[];
      if (isAlreadySelected) {
        next = prev.filter(x => x !== id);
      } else {
        next = [...prev, id];
      }

      if (next.length === 1) {
        const item = treeImages.find(x => x.id === next[0]);
        if (item) setActiveImage(item.image);
      } else if (next.length > 2) {
        const item = treeImages.find(x => x.id === id);
        if (item) setActiveImage(item.image);
      }
      return next;
    });
  };

  const isCompare = selectedIds.length === 2;
  const compareLeftItem = isCompare ? treeImages.find(x => x.id === selectedIds[0]) : null;
  const compareRightItem = isCompare ? treeImages.find(x => x.id === selectedIds[1]) : null;

  const handleSendSingleToCanvas = () => {
    if (selectedIds.length === 1) {
      const selectedItem = treeImages.find(x => x.id === selectedIds[0]);
      if (selectedItem) {
        sessionStorage.setItem(SESSION_KEYS.PRESET_IMAGE, selectedItem.image);
        navigate('/builder');
      }
    }
  };

  const handleSendGroupToCanvas = () => {
    if (selectedIds.length > 1) {
      const selectedItems = treeImages.filter(x => selectedIds.includes(x.id));
      // Capture timestamp once so id and rootSourceId are always identical for each node
      const timestamp = Date.now();
      const nodes = selectedItems.map((item, index) => {
        const nodeId = `source_${timestamp}_${index}`;
        return {
          id: nodeId,
          type: 'baseNode',
          position: { x: 120, y: 200 + index * 240 },
          data: {
            type: 'source',
            processingType: 'source',
            state: 'ready',
            label: item.type || 'Source',
            image: item.image,
            createdAt: timestamp,
            lineage: {
              parentId: null,
              rootSourceId: nodeId,
              generation: 0,
              branchIndex: 0,
              processingType: 'source',
              ancestry: []
            }
          }
        };
      });
      const presetWf = { nodes, edges: [] };
      sessionStorage.setItem(SESSION_KEYS.PRESET_WORKFLOW, JSON.stringify(presetWf));
      navigate('/builder');
    }
  };

  const handleExportActiveImage = () => {
    if (activeImage) {
      handleOpenExport(activeImage, preview.label || 'output');
    }
  };

  const isCopied = copiedId === preview.id;
  const isReused = reusedId === preview.id;

  return (
    <div className="history-overlay">
      <button onClick={onClose} aria-label="Close" style={{ position: 'absolute', inset: 0, background: 'none', border: 'none', padding: 0, width: '100%', height: '100%', cursor: 'default' }} />

      {/* Floating navigation chevrons */}
      {hasPrev && (
        <button
          className="modal-nav-btn prev"
          onClick={(e) => { e.stopPropagation(); onNavigate('prev'); }}
          aria-label="Previous entry"
          title="Previous (←)"
        >
          <ChevronLeft size={22} />
        </button>
      )}
      {hasNext && (
        <button
          className="modal-nav-btn next"
          onClick={(e) => { e.stopPropagation(); onNavigate('next'); }}
          aria-label="Next entry"
          title="Next (→)"
        >
          <ChevronRight size={22} />
        </button>
      )}

      <div className="history-modal">
        <button className="modal-close" onClick={onClose}><X size={18} /></button>
        <div className="modal-tabs">
          <div className="modal-tab active">
            <Eye size={14} /> {isCompare ? 'Compare Mode' : 'Result'}
          </div>
        </div>
        <div className="modal-image-area">
          {isLoadingTree ? (
            <div className="modal-image-skeleton">
              <div className="skeleton-shimmer" style={{ width: '100%', height: '100%', borderRadius: 8 }} />
            </div>
          ) : (
            <PreviewImageArea
              isCompare={isCompare}
              sliderRef={sliderRef}
              handleSliderDown={handleSliderDown}
              leftImage={compareLeftItem?.image || null}
              rightImage={compareRightItem?.image || null}
              singleImage={activeImage}
              label={preview.label}
              sliderPos={sliderPos}
            />
          )}
        </div>

        {/* Dynamic thumbnails section */}
        <div className="modal-thumbnails-section">
          <span className="modal-section-title">Workflow Tree Images</span>
          <div className="modal-thumbnails-row">
            {isLoadingTree && (
              <div className="modal-thumb-card" style={{ opacity: 0.4, pointerEvents: 'none' }}>
                <div className="modal-thumb-img skeleton-shimmer" style={{ width: 64, height: 64, borderRadius: 6 }} />
              </div>
            )}
            {treeImages.map(item => {
              const isSelected = selectedIds.includes(item.id);
              const indexInSelection = selectedIds.indexOf(item.id);
              return (
                <div
                  key={item.id}
                  className={`modal-thumb-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleThumbnailClick(item)}
                >
                  <img src={item.image} alt={item.type} className="modal-thumb-img" />
                  <button
                    className={`modal-thumb-check ${isSelected ? 'checked' : ''}`}
                    onClick={(e) => handleCheckboxClick(e, item.id)}
                    aria-label={`Select ${item.type}`}
                  >
                    {isSelected ? (
                      <div className="check-number">
                        {selectedIds.length > 1 ? indexInSelection + 1 : <Check size={10} strokeWidth={3} />}
                      </div>
                    ) : (
                      <div className="check-empty" />
                    )}
                  </button>
                  <span className="modal-thumb-badge">{item.type}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="modal-info">
          <div className="modal-info-row">
            <h3>{preview.label}</h3>
            <div className="modal-meta">
              <span className="meta-chip type">{preview.type}</span>
              {preview.model && <span className="meta-chip model">{preview.model}</span>}
              {preview.duration && <span className="meta-chip"><Timer size={10} /> {formatDuration(preview.duration)}</span>}
              <span className="meta-chip"><Clock size={10} /> {formatTime(preview.timestamp)}</span>
            </div>
          </div>
          {preview.prompt && (
            <div className="modal-prompt">
              <p>{preview.prompt}</p>
              <div className="prompt-actions">
                <button className={`prompt-btn ${isCopied ? 'feedback' : ''}`} onClick={() => handleCopyPrompt(preview.prompt!, preview.id)}>
                  {isCopied ? <Check size={13} /> : <Copy size={13} />}{isCopied ? 'Copied!' : 'Copy'}
                </button>
                <button className={`prompt-btn ${isReused ? 'feedback' : ''}`} onClick={() => handleReusePrompt(preview.prompt!, preview.id)}>
                  <RotateCcw size={13} className={isReused ? 'spin' : ''} />{isReused ? 'Going...' : 'Reuse'}
                </button>
              </div>
            </div>
          )}
          <div className="modal-actions">
            {selectedIds.length === 1 && (
              <button className="modal-action-btn canvas-btn" onClick={handleSendSingleToCanvas}>
                <FolderOpen size={14} /> Send to Canvas
              </button>
            )}
            {selectedIds.length > 1 && (
              <button className="modal-action-btn canvas-btn" onClick={handleSendGroupToCanvas}>
                <FolderOpen size={14} /> Send Group ({selectedIds.length} Images)
              </button>
            )}
            <button className="modal-action-btn canvas-btn" onClick={() => handleOpenWorkflow(preview)}>
              <BookOpen size={14} /> Send Entire Tree
            </button>
            {activeImage && (
              <button className="modal-action-btn save-btn" onClick={handleExportActiveImage}>
                <Save size={14} /> Export Image
              </button>
            )}
            <button className={`modal-star ${preview.starred ? 'active' : ''}`} onClick={(e) => handleStar(e, preview.id)}>
              {preview.starred ? <StarOff size={14} /> : <Star size={14} />}{preview.starred ? 'Unstar' : 'Star'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════════
   SPLIT CARD — VizMaker-inspired
   ════════════════════════════════════════════════════════════════════ */
const SplitCard: React.FC<{
  entry: HistoryEntry;
  isSelected: boolean;
  isStarred: boolean;
  selectMode: boolean;
  selectedIds: Set<string>;
  isInAnyCollection: boolean;
  onCardClick: () => void;
  onOpenWorkflow: () => void;
  onViewDetails: () => void;
  onStar: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onToggleSelect: () => void;
  onAddToCollection: (e: React.MouseEvent) => void;
}> = ({
  entry, isSelected, isStarred,
  selectMode, selectedIds, isInAnyCollection,
  onCardClick, onOpenWorkflow, onViewDetails, onStar, onDelete,
  onToggleSelect, onAddToCollection,
}) => {
  // Single shared ref — both useLazyImage instances observe the same card element.
  // No unsafe casting, no combinedRef tricks: useLazyImage now accepts externalRef.
  const cardRef = useRef<HTMLDivElement | null>(null);
  const { src: outputSrc } = useLazyImage(entry.id, 'output', entry.outputImage, cardRef);
  const { src: inputSrc }  = useLazyImage(entry.id, 'input',  entry.inputImage,  cardRef);

  const isLoading = !outputSrc && !inputSrc;
  // B/A badge only when BOTH images are actually loaded (not just referenced in metadata)
  const hasBothImages = !!(outputSrc && inputSrc);
  const thumbnailSrc = outputSrc || inputSrc || '';

  // Single stable DOM node — never unmounts, avoids IntersectionObserver losing its target
  return (
    <div
      ref={cardRef}
      className={`history-grid-item${isLoading ? ' skeleton-card' : ''}${isStarred ? ' starred' : ''}${isSelected ? ' selected' : ''}`}
      onClick={() => selectMode ? onToggleSelect() : onCardClick()}
    >
      {isLoading ? (
        /* ── Inline skeleton (same node, no double-wrapping) ── */
        <>
          <div className="grid-image-container skeleton-image">
            <div className="skeleton-shimmer" />
          </div>
          <div className="grid-item-info">
            <div className="skeleton-line sk-prompt" />
            <div className="skeleton-line sk-prompt sk-short" />
            <div className="skeleton-meta-row">
              <div className="skeleton-line sk-model" />
              <div className="skeleton-line sk-date" />
            </div>
          </div>
        </>
      ) : (
        /* ── Real content ── */
        <>
          <div className="grid-image-container single-image">
            <img src={thumbnailSrc} alt={entry.label} className="grid-img-out" loading="lazy" draggable={false} />

            {selectMode && (
              <div className="item-select-check">
                {selectedIds.has(entry.id) ? <CheckSquare size={16} color="#e11d48" /> : <Square size={16} />}
              </div>
            )}

            {hasBothImages && !selectMode && (
              <div className="split-badge">
                <ChevronsLeftRight size={9} strokeWidth={2.5} />
                <span>B/A</span>
              </div>
            )}

            {isInAnyCollection && !selectMode && (
              <div className="collection-badge"><BookmarkPlus size={10} /></div>
            )}

            {!selectMode && (
              <div className="grid-item-actions" onClick={e => e.stopPropagation()}>
                <button className="grid-action-btn" onClick={(e) => { e.stopPropagation(); onOpenWorkflow(); }} title="Use (Workflow)"><FolderOpen size={13} /></button>
                <button className="grid-action-btn" onClick={(e) => { e.stopPropagation(); onViewDetails(); }} title="View Details"><Eye size={13} /></button>
                <button className={`grid-action-btn ${isStarred ? 'star-active' : ''}`} onClick={onStar} title={isStarred ? 'Unstar' : 'Star'}><Star size={13} fill={isStarred ? '#e11d48' : 'none'} /></button>
                <button className={`grid-action-btn ${isInAnyCollection ? 'star-active' : ''}`} onClick={onAddToCollection} title="Add to Collection"><BookmarkPlus size={13} /></button>
                <button className="grid-action-btn" onClick={onDelete} title="Delete"><Trash2 size={13} /></button>
              </div>
            )}
          </div>

          <div className="grid-item-info">
            <span className="grid-item-prompt">{entry.prompt || entry.label}</span>
            <div className="grid-item-meta">
              <span className="grid-item-model">
                {entry.model ? entry.model.split(' ').slice(0, 2).join(' ') : entry.type}
              </span>
              <div className="grid-item-right-meta">
                {entry.duration && entry.duration > 0 && (
                  <span className="grid-item-duration">
                    <Timer size={9} />
                    {formatDuration(entry.duration)}
                  </span>
                )}
                <span className="grid-item-date">{getDateLabel(entry.timestamp)}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};


/* ════════════════════════════════════════════════════════════════════
   HISTORY PAGE
   ════════════════════════════════════════════════════════════════════ */
export const HistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [allEntries, setAllEntries] = useState<HistoryEntry[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedModel, setSelectedModel] = useState('all');
  const [preview, setPreview] = useState<HistoryEntry | null>(null);
  const [sliderPos, setSliderPos] = useState(50);
  const sliderRef = useRef<HTMLButtonElement>(null);
  const isDragging = useRef(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [reusedId, setReusedId] = useState<string | null>(null);
  const [fullOutput, setFullOutput] = useState<string | null>(null);
  const [fullInput, setFullInput] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [exportTarget, setExportTarget] = useState<{ url: string; name: string } | null>(null);
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  /* Collections state */
  const [collections, setCollections] = useState<Collection[]>(CollectionService.load);
  const [showPinboard, setShowPinboard] = useState(false);
  const [activePinboardId, setActivePinboardId] = useState<string | null>(null);
  const [addToColEntry, setAddToColEntry] = useState<string | null>(null);

  const refreshCollections = useCallback(() => setCollections(CollectionService.load()), []);

  const refresh = useCallback(() => setAllEntries(getHistory()), []);

  useEffect(() => { setSelectedIds(new Set()); }, [filter, search]);

  useEffect(() => {
    if (!preview) { setFullOutput(null); setFullInput(null); return; }
    setFullOutput(null); setFullInput(null);
    loadFullImage(preview.id, 'output').then(img => setFullOutput(img));
    loadFullImage(preview.id, 'input').then(img => setFullInput(img));
  }, [preview?.id]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === STORAGE_KEYS.HISTORY || e.key === null) refresh(); };
    const onCustom = () => refresh();
    const onFocus = () => refresh();
    const onVisibility = () => { if (document.visibilityState === 'visible') refresh(); };
    const onCollections = () => refreshCollections();
    globalThis.addEventListener('storage', onStorage);
    globalThis.addEventListener('anarchy:history:updated', onCustom);
    globalThis.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    globalThis.addEventListener('anarchy:collections:updated', onCollections);
    return () => {
      globalThis.removeEventListener('storage', onStorage);
      globalThis.removeEventListener('anarchy:history:updated', onCustom);
      globalThis.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      globalThis.removeEventListener('anarchy:collections:updated', onCollections);
    };
  }, [refresh, refreshCollections]);

  // Primitive string dep — no object reference issues, no ESLint suppress needed
  const previewId = preview?.id ?? null;
  useEffect(() => {
    if (!previewId) return;
    const fresh = allEntries.find(e => e.id === previewId);
    if (!fresh) return;
    setPreview(prev => {
      if (!prev) return prev;
      // Compare only mutable metadata fields — avoids serializing base64 image strings
      const hasChanged =
        fresh.starred   !== prev.starred  ||
        fresh.label     !== prev.label    ||
        fresh.prompt    !== prev.prompt   ||
        fresh.model     !== prev.model    ||
        fresh.duration  !== prev.duration;
      return hasChanged ? fresh : prev;
    });
  }, [allEntries, previewId]);

  /* Slider drag */
  const handleSliderDown = () => { isDragging.current = true; };
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!isDragging.current || !sliderRef.current) return;
      const rect = sliderRef.current.getBoundingClientRect();
      setSliderPos((Math.max(0, Math.min(rect.width, e.clientX - rect.left)) / rect.width) * 100);
    };
    const handleUp = () => { isDragging.current = false; };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => { document.removeEventListener('mousemove', handleMove); document.removeEventListener('mouseup', handleUp); };
  }, []);

  const stats = getHistoryStats();

  /* Filter counts */
  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allEntries.length };
    allEntries.forEach(e => {
      if (e.type) counts[e.type] = (counts[e.type] || 0) + 1;
      if (e.starred) counts.starred = (counts.starred || 0) + 1;
    });
    counts.pinboard = collections.reduce((sum, c) => sum + c.entryIds.length, 0);
    return counts;
  }, [allEntries, collections]);

  /* Unique model names for dropdown */
  const uniqueModels = useMemo(() => {
    const models = new Set<string>();
    allEntries.forEach(e => { if (e.model) models.add(e.model); });
    return Array.from(models).sort();
  }, [allEntries]);

  /* Filtered + sorted entries */
  const filteredEntries = useMemo(() =>
    allEntries
      .filter(e => shouldKeepEntry(e, filter, search, collections, activePinboardId, selectedModel))
      .sort((a, b) => sortAsc ? a.timestamp - b.timestamp : b.timestamp - a.timestamp),
    [allEntries, filter, search, sortAsc, collections, activePinboardId, selectedModel]
  );

  /* Grouped by date */
  const dateGroups = useMemo(() => groupEntriesByDate(filteredEntries), [filteredEntries]);

  /* Handlers */
  const handleStar = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    toggleStar(id);
    refresh(); // storage is updated; refresh reads it — preview sync handled by useEffect above
  }, [refresh]);

  // Per-card async delete, memoized so it's not re-created on every render
  const handleDeleteEntry = useCallback(async (entryId: string) => {
    await Promise.all([
      deleteHistoryEntry(entryId),
      deleteFullImages(entryId),
    ]);
    refresh();
  }, [refresh]);
  const toggleSelect = (id: string) => setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleSelectAll = () => {
    setSelectedIds(selectedIds.size === filteredEntries.length ? new Set() : new Set(filteredEntries.map(e => e.id)));
  };
  const handleBulkDelete = async () => {
    // Fix: await all async IndexedDB deletions before refreshing UI
    await Promise.all(
      Array.from(selectedIds).map(id =>
        Promise.all([deleteHistoryEntry(id), deleteFullImages(id)])
      )
    );
    setSelectedIds(new Set());
    setSelectMode(false);
    setConfirmBulkDelete(false);
    refresh();
  };
  const handleBulkExport = async () => {
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const folder = zip.folder('anarchy-export')!;
      
      const entries = allEntries.filter(e => selectedIds.has(e.id));
      
      for (const e of entries) {
        let url = e.outputImage || e.inputImage;
        if (!url) {
          url = (await loadFullImage(e.id, 'output')) || (await loadFullImage(e.id, 'input')) || '';
        }
        
        if (!url || !url.startsWith('data:')) continue;
        
        const base64Data = url.split(',')[1];
        if (!base64Data) continue;
        
        const safeName = (e.label || e.id).replace(/[^a-zA-Z0-9_\-]/g, '_');
        folder.file(`${safeName}.png`, base64Data, { base64: true });
      }
      
      const blob = await zip.generateAsync({ type: 'blob' });
      const blobUrl = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `anarchy-export-${Date.now()}.zip`;
      a.click();
      
      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
      setSelectedIds(new Set());
      setSelectMode(false);
    } catch (err) {
      logger.error('[History] Bulk export failed:', err);
    }
  };
  const handleCopyPrompt = (prompt: string, id: string) => { navigator.clipboard.writeText(prompt); setCopiedId(id); setTimeout(() => setCopiedId(null), 1800); };
  const handleReusePrompt = (prompt: string, id: string) => { setReusedId(id); sessionStorage.setItem(SESSION_KEYS.PRESET_PROMPT, prompt); setTimeout(() => { setReusedId(null); navigate('/builder'); }, 600); };
  const handleOpenWorkflow = async (entry: HistoryEntry) => {
    const workflow = await loadWorkflowTree(entry.id);
    if (workflow) { sessionStorage.setItem(SESSION_KEYS.LOADED_WORKFLOW, JSON.stringify(workflow)); navigate('/builder'); }
  };
  const handleOpenExport = (url: string, name: string) => setExportTarget({ url, name });
  const handleExportPDF = async () => {
    const entries = (selectMode && selectedIds.size > 0)
      ? allEntries.filter(e => selectedIds.has(e.id))
      : filteredEntries;
    const images = entries.filter(e => e.outputImage).map(e => ({ url: e.outputImage!, name: e.label, prompt: e.prompt }));
    if (images.length > 0) await exportImagesToPDF(images, { title: 'Anarchy AI — History Export' });
  };

  /* Collection handlers */
  const handleAddToCollection = (e: React.MouseEvent, entryId: string) => {
    e.stopPropagation();
    setAddToColEntry(entryId);
  };
  const handleAddToNew = (name: string) => {
    const col = CollectionService.create(name);
    if (addToColEntry) { CollectionService.addEntry(col.id, addToColEntry); }
    refreshCollections();
    setAddToColEntry(null);
  };
  const handleAddTo = (colId: string) => {
    if (addToColEntry) CollectionService.addEntry(colId, addToColEntry);
    refreshCollections();
    setAddToColEntry(null);
  };
  const handleRemoveFrom = (colId: string) => {
    if (addToColEntry) CollectionService.removeEntry(colId, addToColEntry);
    refreshCollections();
  };
  const handleDeleteCollection = (colId: string) => {
    CollectionService.delete(colId);
    if (activePinboardId === colId) setActivePinboardId(null);
    refreshCollections();
  };

  /* Set of entry IDs that are in any collection */
  const collectionEntryIds = useMemo(() =>
    new Set(collections.flatMap(c => c.entryIds)),
    [collections]
  );

  const FILTERS: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'starred', label: '★ Starred' },
    { key: 'pinboard', label: '📌 Collections' },
    { key: 'render', label: 'Render' },
    { key: 'upscale', label: 'Upscale' },
    { key: 'variation', label: 'Variation' },
    { key: 'edit', label: 'Edit' },
    { key: 'generate', label: 'Generate' },
  ];

  /* Modal navigation handler */
  const handleNavigate = useCallback((dir: 'next' | 'prev') => {
    if (!preview) return;
    const idx = filteredEntries.findIndex(e => e.id === preview.id);
    if (idx === -1) return;
    const nextIdx = dir === 'next' ? idx + 1 : idx - 1;
    if (nextIdx >= 0 && nextIdx < filteredEntries.length) {
      setPreview(filteredEntries[nextIdx]);
    }
  }, [preview, filteredEntries]);

  const previewIndex = preview ? filteredEntries.findIndex(e => e.id === preview.id) : -1;
  const hasPrev = previewIndex > 0;
  const hasNext = previewIndex >= 0 && previewIndex < filteredEntries.length - 1;

  return (
    <div className="history-page">
      {/* ── Header ── */}
      <div className="history-header">
        <div className="header-left-group">
          <h1 className="page-title" style={{ fontSize: 20, fontWeight: 700, color: 'white', margin: 0, marginRight: 16 }}>History</h1>
          <div className="history-search">
            <Search size={14} />
            <input type="text" placeholder="Search prompt, model, project..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {uniqueModels.length > 0 && (
            <select
              className="history-model-select"
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
              title="Filter by model"
            >
              <option value="all">All Models</option>
              {uniqueModels.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          )}
        </div>
        <div className="history-header-actions">
          <span className="history-count">{filteredEntries.length} of {allEntries.length}</span>
          <button className="sort-btn" onClick={() => setSortAsc(v => !v)} title={sortAsc ? 'Oldest first' : 'Newest first'}>
            <ArrowUpDown size={14} /><span>{sortAsc ? 'Oldest' : 'Newest'}</span>
          </button>
          {filteredEntries.length > 0 && (
            <button className={`sort-btn ${selectMode ? 'active' : ''}`} onClick={() => { setSelectMode(v => !v); setSelectedIds(new Set()); }} title="Select items">
              <CheckSquare size={14} /><span>Select</span>
            </button>
          )}
          <button className={`sort-btn ${showPinboard ? 'active' : ''}`} onClick={() => setShowPinboard(v => !v)} title="Collections">
            <BookOpen size={14} /><span>Collections{collections.length > 0 ? ` (${collections.length})` : ''}</span>
          </button>
          {filteredEntries.length > 0 && (
            <button className="sort-btn" onClick={handleExportPDF} title="Export to PDF">
              <FileDown size={14} /><span>PDF</span>
            </button>
          )}
          {allEntries.length > 0 && (
            <button className="clear-all-btn" onClick={() => setConfirmClear(true)}>
              <Trash2 size={14} /><span>Clear All</span>
            </button>
          )}
        </div>
      </div>

      <StatsRow stats={stats} />

      {/* ── Bulk bar ── */}
      <BulkActionBar
        selectMode={selectMode}
        selectedCount={selectedIds.size}
        totalCount={filteredEntries.length}
        toggleSelectAll={toggleSelectAll}
        handleBulkExport={handleBulkExport}
        onDeleteClick={() => setConfirmBulkDelete(true)}
      />

      {/* ── Filters with counts ── */}
      <div className="history-filters">
        {FILTERS.map(({ key, label }) => {
          const count = filterCounts[key] || 0;
          if (key !== 'all' && key !== 'starred' && key !== 'pinboard' && count === 0) return null;
          return (
            <button
              key={key}
              className={`hfilter-chip ${filter === key ? 'active' : ''}`}
              onClick={() => { setFilter(key); if (key !== 'pinboard') setActivePinboardId(null); }}
            >
              {label}
              {count > 0 && <span className="filter-count">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* ── Pinboard collection selector (when filter=pinboard) ── */}
      {filter === 'pinboard' && collections.length > 0 && (
        <div className="pinboard-inline-selector">
          <button
            className={`pinboard-chip ${activePinboardId === null ? 'pinboard-chip-active' : ''}`}
            onClick={() => setActivePinboardId(null)}
          >
            All Collections
          </button>
          {collections.map(col => (
            <button
              key={col.id}
              className={`pinboard-chip ${activePinboardId === col.id ? 'pinboard-chip-active' : ''}`}
              onClick={() => setActivePinboardId(col.id)}
            >
              <span className="col-dot" style={{ background: col.color }} />
              {col.name}
              <span className="filter-count">{col.entryIds.length}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Main layout: grid + optional pinboard sidebar ── */}
      <div className={`history-layout ${showPinboard ? 'with-sidebar' : ''}`}>
        <div className="history-grid-container">
          {filteredEntries.length === 0 ? (
            <div className="history-empty">
              <ImageIcon size={40} />
              <h3>{search || filter !== 'all' ? 'No matching entries' : 'No history yet'}</h3>
              <p>
                {search || filter !== 'all'
                  ? 'Try different search or filters'
                  : 'Generate images in the Builder — they will appear here automatically'}
              </p>
            </div>
          ) : (
            <div className="history-grouped">
              {dateGroups.map(group => (
                <div key={group.label} className="history-date-group">
                  <DateGroupHeader label={group.label} count={group.entries.length} />
                  <div className="history-grid">
                    {group.entries.map(entry => {
                      return (
                        <SplitCard
                          key={entry.id}
                          entry={entry}
                          isSelected={selectMode && selectedIds.has(entry.id)}
                          isStarred={entry.starred || false}
                          selectMode={selectMode}
                          selectedIds={selectedIds}
                          isInAnyCollection={collectionEntryIds.has(entry.id)}
                          onCardClick={() => setPreview(entry)}
                          onOpenWorkflow={() => handleOpenWorkflow(entry)}
                          onViewDetails={() => setPreview(entry)}
                          onStar={(e) => handleStar(e, entry.id)}
                          onDelete={(e) => { e.stopPropagation(); handleDeleteEntry(entry.id); }}
                          onToggleSelect={() => toggleSelect(entry.id)}
                          onAddToCollection={(e) => handleAddToCollection(e, entry.id)}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pinboard sidebar */}
        {showPinboard && (
          <PinboardSidebar
            collections={collections}
            activePinboardId={activePinboardId}
            onSelect={(id) => { setActivePinboardId(id); if (id !== null) setFilter('pinboard'); }}
            onDelete={handleDeleteCollection}
            onClose={() => setShowPinboard(false)}
          />
        )}
      </div>

      {/* ── Modals ── */}
      {preview && (
        <PreviewModal
          preview={preview}
          fullInput={fullInput}
          fullOutput={fullOutput}
          sliderRef={sliderRef}
          handleSliderDown={handleSliderDown}
          sliderPos={sliderPos}
          copiedId={copiedId}
          handleCopyPrompt={handleCopyPrompt}
          reusedId={reusedId}
          handleReusePrompt={handleReusePrompt}
          handleOpenWorkflow={handleOpenWorkflow}
          handleOpenExport={handleOpenExport}
          handleStar={handleStar}
          onClose={() => setPreview(null)}
          onNavigate={handleNavigate}
          hasPrev={hasPrev}
          hasNext={hasNext}
        />
      )}
      {addToColEntry && (
        <AddToCollectionModal
          entryId={addToColEntry}
          collections={collections}
          onAddToNew={handleAddToNew}
          onAddTo={handleAddTo}
          onRemoveFrom={handleRemoveFrom}
          onClose={() => setAddToColEntry(null)}
        />
      )}
      {exportTarget && <ExportModal imageUrl={exportTarget.url} imageName={exportTarget.name} onClose={() => setExportTarget(null)} />}
      {confirmClear && (
        <ConfirmModal title="Clear All History" message="Clear all history? This cannot be undone." confirmLabel="Clear All" danger onConfirm={async () => { setConfirmClear(false); await clearHistory(); refresh(); }} onCancel={() => setConfirmClear(false)} />
      )}
      {confirmBulkDelete && (
        <ConfirmModal title="Delete Selected" message={`Delete ${selectedIds.size} selected item${selectedIds.size === 1 ? '' : 's'}?`} confirmLabel={`Delete ${selectedIds.size}`} danger onConfirm={handleBulkDelete} onCancel={() => setConfirmBulkDelete(false)} />
      )}
    </div>
  );
};
