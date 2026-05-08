import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Clock, Star, Save, X,
  Eye, Copy, Zap, Image as ImageIcon,
  Timer, ArrowUpDown, RotateCcw, StarOff, Trash2,
  FolderOpen, ArrowRight, Check
} from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  getHistoryGrouped, getHistoryStats, toggleStar,
  deleteHistoryEntry, clearHistory, formatTime, formatDuration,
  loadFullImage, deleteFullImages,
  type HistoryEntry, type HistoryGroup
} from '../../services/history/HistoryService';
import { ConfirmModal } from '../../components/ConfirmModal';
import { invoke } from '@tauri-apps/api/core';
import { STORAGE_KEYS, SESSION_KEYS } from '../../utils/storageKeys';
import './HistoryPage.css';

type FilterType = 'all' | 'render' | 'upscale' | 'variation' | 'edit' | 'generate' | 'starred';

// Virtual list item type
type VirtualListItem = 
  | { type: 'group'; label: string; count: number }
  | { type: 'entry'; entry: HistoryEntry };

export const HistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<HistoryGroup[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [preview, setPreview] = useState<HistoryEntry | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [sliderPos, setSliderPos] = useState(50);
  const sliderRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  // Feedback states for button animations
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [reusedId, setReusedId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  // Full-resolution images loaded from IndexedDB
  const [fullOutput, setFullOutput] = useState<string | null>(null);
  const [fullInput, setFullInput] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const refresh = useCallback(() => {
    setGroups(getHistoryGrouped());
  }, []);

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

  // Filter and search
  const filteredGroups = groups.map(g => ({
    ...g,
    entries: g.entries.filter(e => {
      if (filter === 'starred' && !e.starred) return false;
      if (filter !== 'all' && filter !== 'starred' && e.type !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          e.label.toLowerCase().includes(q) ||
          (e.prompt?.toLowerCase().includes(q)) ||
          (e.project?.toLowerCase().includes(q)) ||
          (e.model?.toLowerCase().includes(q))
        );
      }
      return true;
    }),
  })).filter(g => g.entries.length > 0);

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

  // Send image to builder canvas as a new source node
  const handleSendToCanvas = (imageUrl: string) => {
    sessionStorage.setItem(SESSION_KEYS.PRESET_IMAGE, imageUrl);
    navigate('/builder');
  };

  // Save image to Documents/Anarchy AI via Tauri
  const handleSaveImage = async (imageUrl: string, label: string, id: string) => {
    setSavingId(id);
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const safeName = label.replace(/[^a-zA-Z0-9\u0600-\u06FF\s]/g, '').trim().slice(0, 40).replace(/\s+/g, '_') || 'image';
      const fileName = `${timestamp}_${safeName}.png`;
      await invoke('save_image_to_documents', { dataUri: imageUrl, fileName });
    } catch (e) {
      console.warn('[History] Save failed:', e);
    } finally {
      setTimeout(() => setSavingId(null), 1500);
    }
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
  const totalFiltered = filteredGroups.reduce((s, g) => s + g.entries.length, 0);

  // Convert filteredGroups to flat virtual list
  const virtualItems: VirtualListItem[] = filteredGroups.flatMap(group => [
    { type: 'group', label: group.label, count: group.entries.length },
    ...group.entries.map(entry => ({ type: 'entry' as const, entry }))
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
      {filteredGroups.length === 0 ? (
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
              
              // item.type === 'entry'
              const entry = item.entry;
              return (
                <div
                  key={entry.id}
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
                    className={`history-item ${entry.starred ? 'starred' : ''}`}
                    onClick={() => { setPreview(entry); setCompareMode(false); setSliderPos(50); }}
                  >
                    {/* Dual thumbnail: source → output */}
                    <div className="history-thumbs-dual">
                      {entry.inputImage ? (
                        <div className="thumb-src-wrap">
                          <img src={entry.inputImage} alt="Source" className="thumb-src" />
                          <span className="thumb-label-src">SRC</span>
                        </div>
                      ) : (
                        <div className="thumb-src-empty"><ImageIcon size={12} /></div>
                      )}
                      <div className="thumb-arrow">→</div>
                      <div className="thumb-out-wrap">
                        {entry.outputImage ? (
                          <img src={entry.outputImage} alt="Output" className="thumb-out" />
                        ) : (
                          <div className="thumb-out-empty"><ImageIcon size={16} /></div>
                        )}
                        <span className="thumb-label-out">OUT</span>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="item-info">
                      <h4 className="item-label">{entry.label}</h4>
                      <p className="item-sub">
                        {entry.model && <span className="item-model">{entry.model}</span>}
                        <span className="item-time-inline">{formatTime(entry.timestamp)}</span>
                      </p>
                    </div>

                    {/* Type badge */}
                    <div className="item-type-badge">{entry.type}</div>

                    {/* Actions */}
                    <div className="item-actions">
                      <button className="item-action" onClick={(e) => { e.stopPropagation(); handleStar(e, entry.id); }} title={entry.starred ? 'Unstar' : 'Star'}>
                        {entry.starred ? <Star size={13} fill="#e11d48" color="#e11d48" /> : <Star size={13} />}
                      </button>
                      <button className="item-action" onClick={(e) => { e.stopPropagation(); handleDelete(e, entry.id); }} title="Delete">
                        <Trash2 size={13} />
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

                {/* Save Output — use full-res if available */}
                {(fullOutput || preview.outputImage) && (
                  <button
                    className={`modal-action-btn save-btn ${savingId === preview.id + '_out' ? 'saving' : ''}`}
                    onClick={() => handleSaveImage(fullOutput || preview.outputImage!, preview.label, preview.id + '_out')}
                  >
                    <Save size={14} />
                    {savingId === preview.id + '_out' ? 'Saved ✓' : 'Save Output'}
                  </button>
                )}

                {/* Save Input — use full-res if available */}
                {(fullInput || preview.inputImage) && (
                  <button
                    className={`modal-action-btn save-btn secondary ${savingId === preview.id + '_in' ? 'saving' : ''}`}
                    onClick={() => handleSaveImage(fullInput || preview.inputImage!, preview.label + '_input', preview.id + '_in')}
                  >
                    <Save size={14} />
                    {savingId === preview.id + '_in' ? 'Saved ✓' : 'Save Input'}
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

      {confirmClear && (
        <ConfirmModal
          title="Clear All History"
          message="Are you sure you want to clear all history? This cannot be undone."
          confirmLabel="Clear All"
          danger
          onConfirm={() => { setConfirmClear(false); clearHistory(); refresh(); }}
          onCancel={() => setConfirmClear(false)}
        />
      )}
    </div>
  );
};
