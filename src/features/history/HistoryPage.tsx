import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Clock, Star, Save, X,
  Eye, Copy, Zap, Image as ImageIcon,
  Timer, ArrowUpDown, RotateCcw, StarOff, Trash2,
  FolderOpen, Check, CheckSquare, Square, Download, Layers
} from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  getHistoryGrouped, getHistoryStats, toggleStar,
  deleteHistoryEntry, clearHistory, formatTime, formatDuration,
  loadFullImage, deleteFullImages,
  type HistoryEntry, type HistoryGroup
} from '../../services/history/HistoryService';
import { ConfirmModal } from '../../components/ConfirmModal';
import { ExportModal } from '../../components/ExportModal';
import { STORAGE_KEYS, SESSION_KEYS } from '../../utils/storageKeys';
import { invoke } from '@tauri-apps/api/core';
import './HistoryPage.css';

type FilterType = 'all' | 'render' | 'upscale' | 'variation' | 'edit' | 'generate' | 'starred';

// Source-based grouping for better organization
interface SourceGroup {
  id: string;
  sourceImage: string;
  sourcePrompt?: string;
  entries: HistoryEntry[];
  createdAt: number;
  project?: string;
}

// Virtual list item type
type VirtualListItem = 
  | { type: 'group'; label: string; count: number }
  | { type: 'source'; source: SourceGroup };

export const HistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<HistoryGroup[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [preview, setPreview] = useState<HistoryEntry | null>(null);
  const [selectedSource, setSelectedSource] = useState<SourceGroup | null>(null);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [sliderPos, setSliderPos] = useState(50);
  const sliderRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  // Feedback states for button animations
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [reusedId, setReusedId] = useState<string | null>(null);
  // Full-resolution images loaded from IndexedDB
  const [fullOutput, setFullOutput] = useState<string | null>(null);
  const [fullInput, setFullInput] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [exportTarget, setExportTarget] = useState<{ url: string; name: string } | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  // Send to canvas options dialog
  const [sendOptions, setSendOptions] = useState<{
    sourceImage: string;
    sourcePrompt?: string;
    nodeTree?: import('../../services/history/HistoryService').NodeTreeData;
    entry?: HistoryEntry;
  } | null>(null);

  const refresh = useCallback(() => {
    setGroups(getHistoryGrouped());
  }, []);

  // Clear selection when filter or search changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [filter, search]);

  // Load full-res images from IndexedDB when a preview is opened
  useEffect(() => {
    if (!preview) { setFullOutput(null); setFullInput(null); return; }
    setFullOutput(null); setFullInput(null);
    loadFullImage(preview.id, 'output').then(img => setFullOutput(img));
    loadFullImage(preview.id, 'input').then(img => setFullInput(img));
  }, [preview?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.HISTORY || e.key === null) refresh();
    };
    const onFocus = () => refresh();
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  const stats = getHistoryStats();

  // Helper function to get node type icon
  const getNodeTypeIcon = (type: string): string => {
    switch (type) {
      case 'source': return '◎';
      case 'ghost': return '○';
      case 'result': return '●';
      default: return '●';
    }
  };

  // Group entries by source image and filter
  const sourceGroups = useMemo(() => {
    const sourceMap = new Map<string, SourceGroup>();
    
    // Flatten all entries
    const allEntries = groups.flatMap(g => g.entries);
    
    for (const entry of allEntries) {
      // Filter first
      if (filter === 'starred' && !entry.starred) continue;
      if (filter !== 'all' && filter !== 'starred' && entry.type !== filter) continue;
      if (search) {
        const q = search.toLowerCase();
        const matches = (
          entry.label.toLowerCase().includes(q) ||
          (entry.prompt?.toLowerCase().includes(q)) ||
          (entry.project?.toLowerCase().includes(q)) ||
          (entry.model?.toLowerCase().includes(q))
        );
        if (!matches) continue;
      }
      
      const sourceKey = entry.inputImage || entry.outputImage || 'no-source';
      
      if (!sourceMap.has(sourceKey)) {
        sourceMap.set(sourceKey, {
          id: `source-${entry.id}`,
          sourceImage: sourceKey === 'no-source' ? entry.outputImage! : sourceKey,
          sourcePrompt: entry.prompt,
          entries: [],
          createdAt: entry.timestamp,
          project: entry.project,
        });
      }
      
      sourceMap.get(sourceKey)!.entries.push(entry);
    }
    
    return Array.from(sourceMap.values())
      .filter(g => g.entries.length > 0)
      .sort((a, b) => sortAsc ? a.createdAt - b.createdAt : b.createdAt - a.createdAt);
  }, [groups, filter, search, sortAsc]);

  const handleStar = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    toggleStar(id);
    refresh();
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteHistoryEntry(id);
    deleteFullImages(id);
    refresh();
    if (preview?.id === id) setPreview(null);
  };

  const handleClearAll = () => setConfirmClear(true);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const allIds = sourceGroups.flatMap(g => g.entries.map(e => e.id));
    if (selectedIds.size === allIds.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  };

  const handleBulkDelete = () => {
    selectedIds.forEach(id => { deleteHistoryEntry(id); deleteFullImages(id); });
    setSelectedIds(new Set());
    setSelectMode(false);
    setConfirmBulkDelete(false);
    refresh();
  };

  const handleBulkExport = async () => {
    const entries = sourceGroups.flatMap(g => g.entries).filter(e => selectedIds.has(e.id));
    const appData = (await invoke<string>('get_app_data_dir').catch(() => '')) as string;
    const exportDir = appData ? `${appData}\\exports` : '';
    if (exportDir) { try { await invoke('ensure_dir', { path: exportDir }); } catch { /* ok */ } }
    for (const e of entries) {
      const url = e.outputImage || e.inputImage;
      if (!url) continue;
      const safeName = (e.label || e.id).replaceAll(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'image';
      if (exportDir && url.startsWith('data:')) {
        const base64 = url.split(',')[1];
        try {
          await invoke('save_file_base64', { path: `${exportDir}\\${safeName}.png`, contents: base64 });
        } catch {
          const a = document.createElement('a');
          a.href = url; a.download = `${safeName}.png`; a.click();
        }
      } else {
        const a = document.createElement('a');
        a.href = url; a.download = `${safeName}.png`; a.click();
      }
      await new Promise(r => setTimeout(r, 100));
    }
  };

  const handleCopyPrompt = (prompt: string, id: string) => {
    navigator.clipboard.writeText(prompt);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleReusePrompt = (prompt: string, id: string) => {
    setReusedId(id);
    sessionStorage.setItem(SESSION_KEYS.PRESET_PROMPT, prompt);
    setTimeout(() => { setReusedId(null); navigate('/builder'); }, 600);
  };

  // Send image to builder canvas as a new source node — prefer full-res from IndexedDB
  const handleSendToCanvas = (fallbackUrl: string) => {
    const imageToSend = fullOutput || fallbackUrl;
    sessionStorage.setItem(SESSION_KEYS.PRESET_IMAGE, imageToSend);
    navigate('/builder');
  };

  const handleOpenExport = (url: string, name: string) => {
    setExportTarget({ url, name });
  };

  // Compare slider drag
  const handleSliderDown = () => { isDragging.current = true; };
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!isDragging.current || !sliderRef.current) return;
      const rect = sliderRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      setSliderPos((x / rect.width) * 100);
    };
    const handleUp = () => { isDragging.current = false; };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
  }, []);

  const allEntries = groups.flatMap(g => g.entries);
  const totalFiltered = sourceGroups.reduce((s, g) => s + g.entries.length, 0);

  // Convert sourceGroups to flat virtual list
  const virtualItems: VirtualListItem[] = sourceGroups.flatMap(group => [
    { type: 'group', label: group.project || 'History', count: group.entries.length },
    { type: 'source', source: group }
  ]);

  // Virtual scrolling setup
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: virtualItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => {
      // Group header: ~40px, Entry: ~120px
      return 120;
    },
    overscan: 5,
  });

  return (
    <div className="history-page">
      {/* Header */}
      <div className="history-header">
        <div className="header-left-group">
          <h1 className="page-title">History</h1>
          <div className="history-search">
            <Search size={14} />
            <input
              type="text"
              placeholder="Search by prompt, project, model..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="history-header-actions">
          <span className="history-count">{totalFiltered} of {allEntries.length}</span>
          <button
            className="sort-btn"
            title={sortAsc ? 'Oldest first' : 'Newest first'}
            onClick={() => setSortAsc(v => !v)}
          >
            <ArrowUpDown size={14} />
            <span>{sortAsc ? 'Oldest' : 'Newest'}</span>
          </button>
          {totalFiltered > 0 && (
            <button
              className={`sort-btn ${selectMode ? 'active' : ''}`}
              onClick={() => { setSelectMode(v => !v); setSelectedIds(new Set()); }}
              title="Select items"
            >
              <CheckSquare size={14} />
              <span>Select</span>
            </button>
          )}
          {allEntries.length > 0 && (
            <button className="clear-all-btn" onClick={handleClearAll}>
              <Trash2 size={14} />
              <span>Clear All</span>
            </button>
          )}
        </div>
      </div>

      {/* Stats Row */}
      {stats.total > 0 && (
        <div className="history-stats">
          <div className="hstat">
            <Zap size={14} className="hstat-icon" />
            <span className="hstat-val">{stats.total}</span>
            <span className="hstat-label">Total</span>
          </div>
          <div className="hstat">
            <Clock size={14} className="hstat-icon" />
            <span className="hstat-val">{stats.todayCount}</span>
            <span className="hstat-label">Today</span>
          </div>
          <div className="hstat">
            <Star size={14} className="hstat-icon" />
            <span className="hstat-val">{stats.starred}</span>
            <span className="hstat-label">Starred</span>
          </div>
          <div className="hstat">
            <Timer size={14} className="hstat-icon" />
            <span className="hstat-val">{stats.totalDuration > 0 ? formatDuration(stats.totalDuration) : '—'}</span>
            <span className="hstat-label">Total Time</span>
          </div>
        </div>
      )}

      {/* Bulk-select action bar */}
      {selectMode && (
        <div className="bulk-action-bar">
          <button className="bulk-select-all" onClick={toggleSelectAll}>
            {selectedIds.size === sourceGroups.flatMap(g => g.entries).length
              ? <><CheckSquare size={14} /> Deselect All</>
              : <><Square size={14} /> Select All</>}
          </button>
          <span className="bulk-count">{selectedIds.size} selected</span>
          <div className="bulk-actions">
            <button
              className="bulk-btn"
              onClick={handleBulkExport}
              disabled={selectedIds.size === 0}
              title="Export selected"
            >
              <Download size={14} /> Export
            </button>
            <button
              className="bulk-btn danger"
              onClick={() => setConfirmBulkDelete(true)}
              disabled={selectedIds.size === 0}
              title="Delete selected"
            >
              <Trash2 size={14} /> Delete ({selectedIds.size})
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="history-filters">
        {(['all', 'starred', 'render', 'upscale', 'variation', 'edit', 'generate'] as FilterType[]).map(f => (
          <button
            key={f}
            className={`hfilter-chip ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'starred' ? <Star size={12} /> : null}
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Timeline */}
      {sourceGroups.length === 0 ? (
        <div className="history-empty">
          <ImageIcon size={40} />
          <h3>{search || filter !== 'all' ? 'No matching entries' : 'No history yet'}</h3>
          <p>{search || filter !== 'all' ? 'Try different search or filters' : 'Generate images in the Builder — they will appear here automatically'}</p>
        </div>
      ) : (
        <div 
          className="history-timeline" 
          ref={parentRef}
          style={{ height: 'calc(100vh - 280px)', overflow: 'auto' }}
        >
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map(virtualRow => {
              const item = virtualItems[virtualRow.index];
              
              if (item.type === 'group') {
                return (
                  <div
                    key={`group-${virtualRow.index}`}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <div className="day-header">
                      <Clock size={14} className="day-icon" />
                      <span>{item.label}</span>
                      <span className="day-count">{item.count}</span>
                    </div>
                  </div>
                );
              }
              
              // item.type === 'source'
              const group = item.source;
              const isSelected = selectMode && group.entries.some(e => selectedIds.has(e.id));
              return (
                <div
                  key={group.id}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div
                    className={`history-item source-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      if (selectMode) { 
                        group.entries.forEach(e => toggleSelect(e.id)); 
                        return; 
                      }
                      setSelectedSource(group);
                    }}
                  >
                    {selectMode && (
                      <div className="item-select-check">
                        {group.entries.every(e => selectedIds.has(e.id))
                          ? <CheckSquare size={16} color="#e11d48" />
                          : <Square size={16} />}
                      </div>
                    )}
                    
                    {/* Source image with result count badge */}
                    <div className="history-thumbs-source">
                      <div className="thumb-source-wrap">
                        <img src={group.sourceImage} alt="Source" className="thumb-source" />
                        <div className="result-count-badge">
                          <Layers size={10} />
                          <span>{group.entries.length}</span>
                        </div>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="item-info">
                      <h4 className="item-label">{group.sourcePrompt?.slice(0, 50) || 'Source Image'}{group.sourcePrompt && group.sourcePrompt.length > 50 ? '...' : ''}</h4>
                      <p className="item-sub">
                        <span className="item-count">{group.entries.length} results</span>
                        <span className="item-time-inline">{formatTime(group.createdAt)}</span>
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="item-actions">
                      <button className="item-action" onClick={(e) => { e.stopPropagation(); setSelectedSource(group); }} title="View Results">
                        <Eye size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Preview / Compare Modal */}
      {preview && (
        <div className="history-overlay" onClick={() => setPreview(null)}>
          <div className="history-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setPreview(null)}><X size={18} /></button>

            {/* Tabs: Result | Compare */}
            <div className="modal-tabs">
              <button className={`modal-tab ${!compareMode ? 'active' : ''}`} onClick={() => setCompareMode(false)}>
                <Eye size={14} /> Result
              </button>
              {preview.inputImage && preview.outputImage && (
                <button className={`modal-tab ${compareMode ? 'active' : ''}`} onClick={() => setCompareMode(true)}>
                  <ArrowUpDown size={14} /> Compare
                </button>
              )}
            </div>

            {/* Image area — uses full-res from IndexedDB, falls back to thumbnail */}
            <div className="modal-image-area">
              {compareMode && (fullInput || preview.inputImage) && (fullOutput || preview.outputImage) ? (
                <div
                  className="compare-slider"
                  ref={sliderRef}
                  onMouseDown={handleSliderDown}
                >
                  {/* After image — absolute full size underneath */}
                  <img src={fullOutput || preview.outputImage!} alt="After" className="compare-img after" draggable={false} />
                  {/* Before image — clipped to left portion, img keeps full container width */}
                  <div className="compare-clip" style={{ width: `${sliderPos}%` }}>
                    <img
                      src={fullInput || preview.inputImage!}
                      alt="Before"
                      className="compare-img"
                      draggable={false}
                      style={{ width: sliderRef.current ? `${sliderRef.current.offsetWidth}px` : '100%' }}
                    />
                  </div>
                  {/* Divider handle */}
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
                </div>
              ) : (
                <img
                  src={fullOutput || preview.outputImage || fullInput || preview.inputImage || ''}
                  alt={preview.label}
                  className="modal-preview-img"
                />
              )}
            </div>

            {/* Info */}
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
                    <button
                      className={`prompt-btn ${copiedId === preview.id ? 'feedback' : ''}`}
                      onClick={() => handleCopyPrompt(preview.prompt!, preview.id)}
                    >
                      {copiedId === preview.id ? <Check size={13} /> : <Copy size={13} />}
                      {copiedId === preview.id ? 'Copied!' : 'Copy'}
                    </button>
                    <button
                      className={`prompt-btn ${reusedId === preview.id ? 'feedback' : ''}`}
                      onClick={() => handleReusePrompt(preview.prompt!, preview.id)}
                    >
                      <RotateCcw size={13} className={reusedId === preview.id ? 'spin' : ''} />
                      {reusedId === preview.id ? 'Going...' : 'Reuse'}
                    </button>
                  </div>
                </div>
              )}

              <div className="modal-actions">
                {/* Send to Canvas */}
                {(preview.outputImage || preview.inputImage) && (
                  <button className="modal-action-btn canvas-btn" onClick={() => handleSendToCanvas(preview.outputImage || preview.inputImage!)}>
                    <FolderOpen size={14} /> Send to Canvas
                  </button>
                )}

                {/* Copy image URL */}
                {(fullOutput || preview.outputImage) && (
                  <button
                    className={`modal-action-btn ${copiedUrl === preview.id ? 'feedback' : ''}`}
                    onClick={() => {
                      const url = fullOutput || preview.outputImage!;
                      navigator.clipboard.writeText(url);
                      setCopiedUrl(preview.id);
                      setTimeout(() => setCopiedUrl(null), 1800);
                    }}
                  >
                    {copiedUrl === preview.id ? <Check size={14} /> : <Copy size={14} />}
                    {copiedUrl === preview.id ? 'Copied!' : 'Copy URL'}
                  </button>
                )}

                {/* Export Output — use full-res if available */}
                {(fullOutput || preview.outputImage) && (
                  <button
                    className="modal-action-btn save-btn"
                    onClick={() => handleOpenExport(fullOutput || preview.outputImage!, preview.label || 'output')}
                  >
                    <Save size={14} />
                    Export Output
                  </button>
                )}

                {/* Export Input — use full-res if available */}
                {(fullInput || preview.inputImage) && (
                  <button
                    className="modal-action-btn save-btn secondary"
                    onClick={() => handleOpenExport(fullInput || preview.inputImage!, (preview.label || 'input') + '_source')}
                  >
                    <Save size={14} />
                    Export Input
                  </button>
                )}

                {/* Star */}
                <button className={`modal-star ${preview.starred ? 'active' : ''}`} onClick={(e) => { handleStar(e, preview.id); setPreview({ ...preview, starred: !preview.starred }); }}>
                  {preview.starred ? <StarOff size={14} /> : <Star size={14} />}
                  {preview.starred ? 'Unstar' : 'Star'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Source & Results Modal */}
      {selectedSource && (
        <div className="history-overlay" onClick={() => setSelectedSource(null)}>
          <div className="history-modal results-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedSource(null)}><X size={18} /></button>
            
            {/* Brand Header */}
            <div className="modal-header">
              <span className="modal-brand">ANARCHY</span>
            </div>
            
            {/* Source Section */}
            <div className="source-section">
              <h3 className="section-title">Source Image</h3>
              <div className="source-image-wrap" onClick={() => setEnlargedImage(selectedSource.sourceImage)}>
                <img src={selectedSource.sourceImage} alt="Source" />
              </div>
              {selectedSource.sourcePrompt && (
                <p className="source-prompt">{selectedSource.sourcePrompt}</p>
              )}
              <div className="source-actions">
                <button 
                  className="modal-action-btn canvas-btn" 
                  onClick={() => {
                    // Find entry with nodeTree
                    const entryWithTree = selectedSource.entries.find(e => e.nodeTree?.nodes?.length > 0);
                    setSendOptions({
                      sourceImage: selectedSource.sourceImage,
                      sourcePrompt: selectedSource.sourcePrompt,
                      nodeTree: entryWithTree?.nodeTree,
                      entry: entryWithTree,
                    });
                  }}
                >
                  <FolderOpen size={14} /> Send to Canvas
                </button>
              </div>
            </div>
            
            {/* Node Tree Section */}
            {selectedSource.entries.some(e => e.nodeTree?.nodes?.length > 0) && (
              <div className="node-tree-section">
                <h3 className="section-title">Node Tree</h3>
                <div className="node-tree-grid">
                  {selectedSource.entries
                    .filter(e => e.nodeTree?.nodes?.length > 0)
                    .map(entry => (
                      <div key={entry.id} className="node-tree-item">
                        <div className="node-tree-header">
                          <span className="node-tree-type">{entry.type}</span>
                          <span className="node-count">{entry.nodeTree?.nodes?.length || 0} nodes</span>
                        </div>
                        <div className="node-tree-visual">
                          {entry.nodeTree?.nodes?.slice(0, 5).map((node, idx) => (
                            <div 
                              key={node.id} 
                              className={`node-tree-node ${node.type}`}
                              style={{ marginLeft: idx * 12 }}
                              role="listitem"
                            >
                              <span className="node-type-icon">{getNodeTypeIcon(node.type)}</span>
                              <span className="node-type-label">{node.type}</span>
                              {node.image && (
                                <button
                                  className="node-thumbnail-btn"
                                  onClick={() => setEnlargedImage(node.image!)}
                                  aria-label={`View ${node.type} image`}
                                >
                                  <img 
                                    src={node.image} 
                                    alt={node.type}
                                    className="node-thumbnail"
                                  />
                                </button>
                              )}
                            </div>
                          ))}
                          {(entry.nodeTree?.nodes?.length || 0) > 5 && (
                            <div className="more-nodes">+{(entry.nodeTree?.nodes?.length || 0) - 5} more</div>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Results Grid */}
            <div className="results-section">
              <h3 className="section-title">Generated Results ({selectedSource.entries.length})</h3>
              <div className="results-grid">
                {selectedSource.entries.map(entry => (
                  <div key={entry.id} className="result-item" onClick={() => { setPreview(entry); setSelectedSource(null); }}>
                    <div className="result-image-box">
                      <img src={entry.outputImage || entry.inputImage} alt={entry.type} />
                      <div className="result-hover-actions">
                        <button className="result-action-btn" onClick={(e) => { e.stopPropagation(); setPreview(entry); setSelectedSource(null); }} title="View">
                          <Eye size={12} />
                        </button>
                      </div>
                    </div>
                    <div className="result-info">
                      <span className="result-type">{entry.type}</span>
                      <span className="result-date">{formatTime(entry.timestamp)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {exportTarget && (
        <ExportModal
          imageUrl={exportTarget.url}
          imageName={exportTarget.name}
          onClose={() => setExportTarget(null)}
        />
      )}

      {/* Enlarged Image View */}
      {enlargedImage && (
        <div className="history-overlay enlarged-overlay" onClick={() => setEnlargedImage(null)}>
          <div className="enlarged-image-container" onClick={e => e.stopPropagation()}>
            <button className="modal-close enlarged-close" onClick={() => setEnlargedImage(null)}>
              <X size={20} />
            </button>
            <img src={enlargedImage} alt="Full size" className="enlarged-img" />
          </div>
        </div>
      )}

      {confirmClear && (
        <ConfirmModal
          title="Clear All History"
          message="Are you sure you want to clear all history? This cannot be undone."
          confirmLabel="Clear All"
          danger
          onConfirm={async () => { setConfirmClear(false); await clearHistory(); refresh(); }}
          onCancel={() => setConfirmClear(false)}
        />
      )}
      {confirmBulkDelete && (
        <ConfirmModal
          title="Delete Selected"
          message={`Delete ${selectedIds.size} selected item${selectedIds.size !== 1 ? 's' : ''}? This cannot be undone.`}
          confirmLabel={`Delete ${selectedIds.size}`}
          danger
          onConfirm={handleBulkDelete}
          onCancel={() => setConfirmBulkDelete(false)}
        />
      )}

      {/* Send to Canvas Options Dialog */}
      {sendOptions && (
        <div className="history-overlay" onClick={() => setSendOptions(null)}>
          <div className="send-options-modal" onClick={e => e.stopPropagation()}>
            <h3 className="send-options-title">Send to Canvas</h3>
            <p className="send-options-desc">
              {sendOptions.nodeTree?.nodes?.length 
                ? `Found ${sendOptions.nodeTree.nodes.length} nodes. What would you like to send?`
                : 'What would you like to send to the canvas?'}
            </p>
            
            <div className="send-options-buttons">
              {sendOptions.nodeTree?.nodes?.length > 0 && (
                <button 
                  className="send-option-btn all-nodes"
                  onClick={() => {
                    // Send all nodes
                    sessionStorage.setItem(SESSION_KEYS.PRESET_IMAGE, sendOptions.sourceImage);
                    if (sendOptions.sourcePrompt) sessionStorage.setItem(SESSION_KEYS.PRESET_PROMPT, sendOptions.sourcePrompt);
                    sessionStorage.setItem(SESSION_KEYS.LOADED_WORKFLOW, JSON.stringify({
                      nodes: sendOptions.nodeTree?.nodes,
                      name: 'History Import',
                    }));
                    setSendOptions(null);
                    setSelectedSource(null);
                    navigate('/builder');
                  }}
                >
                  <span className="btn-icon">🌳</span>
                  <span className="btn-text">Send All Nodes</span>
                  <span className="btn-subtext">{sendOptions.nodeTree?.nodes?.length} nodes</span>
                </button>
              )}
              
              <button 
                className="send-option-btn selected-only"
                onClick={() => {
                  // Send only source image
                  sessionStorage.setItem(SESSION_KEYS.PRESET_IMAGE, sendOptions.sourceImage);
                  if (sendOptions.sourcePrompt) sessionStorage.setItem(SESSION_KEYS.PRESET_PROMPT, sendOptions.sourcePrompt);
                  setSendOptions(null);
                  setSelectedSource(null);
                  navigate('/builder');
                }}
              >
                <span className="btn-icon">🖼️</span>
                <span className="btn-text">Source Image Only</span>
                <span className="btn-subtext">Just the image</span>
              </button>
            </div>
            
            <button className="send-options-cancel" onClick={() => setSendOptions(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
