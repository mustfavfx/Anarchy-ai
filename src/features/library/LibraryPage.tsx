import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { logger } from '../../utils/logger';
import { 
  Search, LayoutGrid, LayoutList, Image as ImageIcon,
  Clock, Download, Copy, Trash2, Star, Send, Eye,
  ArrowUpDown, FileDown, Check, X, Sparkles
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ConfirmModal } from '../../shared/components/ConfirmModal';
import { 
  loadEntries, 
  deleteHistoryEntry, 
  toggleStar, 
  type HistoryEntry 
} from '../../services/history/HistoryService';
import { listProjects } from '../../services/projects/ProjectService';
import { SESSION_KEYS } from '../../utils/storageKeys';
import { exportImagesToPDFWithDialog } from '../../services/export';
import { useNotificationStore } from '../../stores/notificationStore';
import { useResolvedImage } from '../../hooks/useResolvedImage';
import { useTranslation } from '../../services/i18n';
import './LibraryPage.css';

const LIBRARY_VIEW_MODE_KEY = 'anarchy_library_view_mode';
const LIBRARY_FILTER_KEY = 'anarchy_library_filter';
const LIBRARY_SORT_KEY = 'anarchy_library_sort';

type FilterType = 'all' | 'renders' | 'starred';

export interface LibraryAsset {
  id: string;
  url: string;
  prompt: string;
  timestamp: number;
  starred: boolean;
  model?: string;
  source: 'history' | 'project';
  sourceName?: string;
}

export const LibraryThumbnail: React.FC<{ url: string; alt: string; className?: string }> = ({ url, alt, className }) => {
  const resolved = useResolvedImage(url);
  if (!url || !resolved) {
    return (
      <div className={`project-placeholder ${className || ''}`}>
        <ImageIcon size={32} />
      </div>
    );
  }
  return <img src={resolved} alt={alt} className={className} loading="lazy" />;
};

export const LibraryPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const addNotification = useNotificationStore(state => state.addNotification);

  const [assets, setAssets] = useState<LibraryAsset[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState<LibraryAsset | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmDeleteAsset, setConfirmDeleteAsset] = useState<LibraryAsset | null>(null);

  // Persistent preferences
  const [viewMode, setViewModeState] = useState<'grid' | 'list'>(() => {
    try {
      const saved = localStorage.getItem(LIBRARY_VIEW_MODE_KEY);
      if (saved === 'grid' || saved === 'list') return saved;
    } catch {}
    return 'grid';
  });

  const [filter, setFilterState] = useState<FilterType>(() => {
    try {
      const saved = localStorage.getItem(LIBRARY_FILTER_KEY) as FilterType;
      if (saved === 'all' || saved === 'renders' || saved === 'starred') return saved;
    } catch {}
    return 'all';
  });

  const [sortOrder, setSortOrderState] = useState<'newest' | 'oldest' | 'prompt'>(() => {
    try {
      const saved = localStorage.getItem(LIBRARY_SORT_KEY) as 'newest' | 'oldest' | 'prompt';
      if (saved === 'newest' || saved === 'oldest' || saved === 'prompt') return saved;
    } catch {}
    return 'newest';
  });

  const setViewMode = (mode: 'grid' | 'list') => {
    setViewModeState(mode);
    try { localStorage.setItem(LIBRARY_VIEW_MODE_KEY, mode); } catch {}
  };

  const setFilter = (nextFilter: FilterType) => {
    setFilterState(nextFilter);
    try { localStorage.setItem(LIBRARY_FILTER_KEY, nextFilter); } catch {}
  };

  const setSortOrder = (updater: 'newest' | 'oldest' | 'prompt' | ((prev: 'newest' | 'oldest' | 'prompt') => 'newest' | 'oldest' | 'prompt')) => {
    setSortOrderState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try { localStorage.setItem(LIBRARY_SORT_KEY, next); } catch {}
      return next;
    });
  };

  // Load all media assets from History & saved project outputs
  const loadAssets = useCallback(async () => {
    setLoading(true);
    try {
      const items: LibraryAsset[] = [];

      // 1. History generation entries
      const historyEntries = loadEntries();
      historyEntries.forEach(entry => {
        const imageUrl = entry.outputImage || entry.inputImage;
        if (imageUrl) {
          items.push({
            id: entry.id,
            url: imageUrl,
            prompt: entry.prompt || 'Generated Render',
            timestamp: entry.timestamp || Date.now(),
            starred: !!entry.starred,
            model: entry.model,
            source: 'history',
          });
        }
      });

      // 2. Project thumbnail outputs
      try {
        const projects = await listProjects();
        projects.forEach(p => {
          if (p.thumbnailUrl) {
            items.push({
              id: `proj-thumb-${p.filePath}`,
              url: p.thumbnailUrl,
              prompt: p.promptSnippet || p.name,
              timestamp: p.updatedAt || p.createdAt,
              starred: false,
              model: p.modelTag || 'Project Workflow',
              source: 'project',
              sourceName: p.name,
            });
          }
        });
      } catch {}

      setAssets(items);
    } catch (err) {
      logger.error('[Library] Failed to load assets:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  // Filter & sort
  const filteredAssets = useMemo(() => {
    let list = assets.filter(item => {
      if (search && !item.prompt.toLowerCase().includes(search.toLowerCase())) return false;
      if (filter === 'starred' && !item.starred) return false;
      if (filter === 'renders' && item.source !== 'history') return false;
      return true;
    });

    return list.sort((a, b) => {
      if (sortOrder === 'prompt') return a.prompt.localeCompare(b.prompt);
      if (sortOrder === 'oldest') return a.timestamp - b.timestamp;
      return b.timestamp - a.timestamp;
    });
  }, [assets, search, filter, sortOrder]);

  // Action handlers
  const handleToggleStar = async (e: React.MouseEvent, asset: LibraryAsset) => {
    e.stopPropagation();
    if (asset.source === 'history') {
      try {
        await toggleStar(asset.id);
        setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, starred: !a.starred } : a));
        if (selectedAsset?.id === asset.id) {
          setSelectedAsset(prev => prev ? { ...prev, starred: !prev.starred } : null);
        }
      } catch (err) {
        logger.error('[Library] Toggle star failed:', err);
      }
    }
  };

  const handleOpenInBuilder = (asset: LibraryAsset) => {
    if (asset.prompt) {
      sessionStorage.setItem(SESSION_KEYS.PRESET_PROMPT, asset.prompt);
    }
    navigate('/builder');
  };

  const handleCopyImage = async (e: React.MouseEvent, asset: LibraryAsset) => {
    e.stopPropagation();
    try {
      if (asset.url.startsWith('data:image')) {
        const res = await fetch(asset.url);
        const blob = await res.blob();
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      } else {
        await navigator.clipboard.writeText(asset.url);
      }
      setCopiedId(asset.id);
      setTimeout(() => setCopiedId(null), 1500);
      addNotification({ type: 'success', title: 'Copied', message: 'Asset copied to clipboard' });
    } catch {
      await navigator.clipboard.writeText(asset.prompt);
      addNotification({ type: 'info', title: 'Prompt Copied', message: 'Image prompt copied to clipboard' });
    }
  };

  const handleDownloadImage = (e: React.MouseEvent, asset: LibraryAsset) => {
    e.stopPropagation();
    const a = document.createElement('a');
    a.href = asset.url;
    a.download = `anarchy-asset-${asset.id.slice(0, 8)}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDeleteAsset) return;
    const target = confirmDeleteAsset;
    setConfirmDeleteAsset(null);

    if (target.source === 'history') {
      try {
        await deleteHistoryEntry(target.id);
        setAssets(prev => prev.filter(a => a.id !== target.id));
        if (selectedAsset?.id === target.id) setSelectedAsset(null);
        addNotification({ type: 'success', title: 'Asset Deleted', message: 'Image removed from library' });
      } catch (err) {
        logger.error('[Library] Delete failed:', err);
      }
    } else {
      setAssets(prev => prev.filter(a => a.id !== target.id));
      if (selectedAsset?.id === target.id) setSelectedAsset(null);
    }
  };

  const handleExportAllToPDF = async () => {
    const renderItems = filteredAssets.map(a => ({
      url: a.url,
      name: a.sourceName || a.model || 'Asset',
      prompt: a.prompt,
    }));

    if (renderItems.length === 0) {
      addNotification({ type: 'warning', title: 'Export Empty', message: 'No assets selected to export' });
      return;
    }

    const path = await exportImagesToPDFWithDialog(renderItems, {
      title: 'Anarchy AI — Library Assets Export',
      author: 'Anarchy AI',
      subject: 'Library Media & Render Outputs'
    });

    if (path) {
      addNotification({ type: 'success', title: 'PDF Exported', message: `Saved to: ${path.split(/[\\/]/).pop()}` });
    }
  };

  return (
    <div className="library-page">
      {/* Top Header & Search Bar */}
      <div className="library-controls">
        <div className="header-left-group">
          <div>
            <h1 className="page-title">Library</h1>
            <span className="stats-text" style={{ fontSize: '12px' }}>
              Image Assets & Render Outputs ({assets.length})
            </span>
          </div>

          <div className="library-search">
            <Search size={14} />
            <input
              type="text"
              placeholder="Search assets by prompt or model..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label="Search image assets"
            />
          </div>

          <div className="library-view-toggle">
            <button
              type="button"
              className={`library-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              aria-label="Grid view"
              title="Grid view"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              type="button"
              className={`library-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              aria-label="List view"
              title="List view"
            >
              <LayoutList size={15} />
            </button>
          </div>
        </div>

        {/* Filters & Actions */}
        <div className="library-filter-group">
          <button 
            type="button"
            className={`filter-chip ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({assets.length})
          </button>
          <button 
            type="button"
            className={`filter-chip ${filter === 'renders' ? 'active' : ''}`}
            onClick={() => setFilter('renders')}
          >
            Renders ({assets.filter(a => a.source === 'history').length})
          </button>
          <button 
            type="button"
            className={`filter-chip ${filter === 'starred' ? 'active' : ''}`}
            onClick={() => setFilter('starred')}
          >
            Starred ({assets.filter(a => a.starred).length})
          </button>

          <button
            type="button"
            className="filter-chip"
            title="Toggle sort order"
            onClick={() => setSortOrder(o => o === 'newest' ? 'oldest' : o === 'oldest' ? 'prompt' : 'newest')}
            style={{ marginLeft: 8 }}
          >
            <ArrowUpDown size={12} />
            <span>{sortOrder === 'newest' ? 'Newest' : sortOrder === 'oldest' ? 'Oldest' : 'Prompt'}</span>
          </button>

          <button
            type="button"
            className="filter-chip"
            onClick={handleExportAllToPDF}
            title="Export filtered assets to PDF"
          >
            <FileDown size={13} />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="library-loading">
          <Sparkles size={24} className="spin" />
          <span>Loading media assets...</span>
        </div>
      ) : filteredAssets.length === 0 ? (
        <div className="library-empty">
          <ImageIcon size={40} />
          <h3>{search || filter !== 'all' ? 'No matching image assets' : 'Your asset library is empty'}</h3>
          <p>
            {search || filter !== 'all'
              ? 'Try changing your search keywords or active filter.'
              : 'Generated renders and saved workflow images will appear here.'}
          </p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => navigate('/builder')}
            style={{ marginTop: 16 }}
          >
            Create in Builder
          </button>
        </div>
      ) : (
        <div className={`assets-grid ${viewMode === 'list' ? 'assets-list' : ''}`}>
          {filteredAssets.map(asset => (
            <div
              key={asset.id}
              className="asset-card"
              onClick={() => setSelectedAsset(asset)}
              tabIndex={0}
              role="button"
              onKeyDown={e => e.key === 'Enter' && setSelectedAsset(asset)}
            >
              <div className="asset-image-box">
                <LibraryThumbnail url={asset.url} alt={asset.prompt} />
                
                {asset.starred && (
                  <span className="project-status-badge active" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Star size={10} fill="currentColor" /> Starred
                  </span>
                )}

                <div className="asset-hover-actions">
                  <button
                    type="button"
                    onClick={(e) => handleToggleStar(e, asset)}
                    title={asset.starred ? 'Unstar' : 'Star'}
                    aria-label="Star asset"
                  >
                    <Star size={14} fill={asset.starred ? '#fbbf24' : 'none'} color={asset.starred ? '#fbbf24' : '#fff'} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleCopyImage(e, asset)}
                    title="Copy image"
                    aria-label="Copy image"
                  >
                    {copiedId === asset.id ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDownloadImage(e, asset)}
                    title="Download"
                    aria-label="Download image"
                  >
                    <Download size={14} />
                  </button>
                </div>
              </div>

              <div className="asset-info" style={{ padding: '10px 14px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#f3f4f6', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {asset.prompt}
                </h4>
                <div className="project-meta-row" style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#9ca3af' }}>
                  <span>{asset.model || (asset.source === 'project' ? 'Project Asset' : 'AI Render')}</span>
                  <span>{new Date(asset.timestamp).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Asset Details Preview Modal */}
      {selectedAsset && (
        <div className="library-preview-overlay" onClick={() => setSelectedAsset(null)}>
          <div className="library-preview-modal results-modal" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              className="preview-close"
              onClick={() => setSelectedAsset(null)}
              aria-label="Close preview"
            >
              <X size={18} />
            </button>

            {/* Modal Left: Image Preview */}
            <div className="source-section">
              <h3 className="section-title">Asset Preview</h3>
              <div className="source-image-wrap project-preview-img-wrap">
                <LibraryThumbnail url={selectedAsset.url} alt={selectedAsset.prompt} className="large" />
              </div>
              <div className="source-actions flex-wrap" style={{ gap: 8, marginTop: 16 }}>
                <button
                  type="button"
                  className="preview-download-btn w-full"
                  onClick={() => handleOpenInBuilder(selectedAsset)}
                >
                  <Send size={14} />
                  <span>Open in Builder</span>
                </button>
                <button
                  type="button"
                  className="preview-download-btn secondary flex-1"
                  onClick={(e) => handleCopyImage(e, selectedAsset)}
                >
                  <Copy size={14} />
                  <span>{copiedId === selectedAsset.id ? 'Copied!' : 'Copy Image'}</span>
                </button>
                <button
                  type="button"
                  className="preview-download-btn secondary flex-1"
                  onClick={(e) => handleDownloadImage(e, selectedAsset)}
                >
                  <Download size={14} />
                  <span>Download</span>
                </button>
                <button
                  type="button"
                  className="preview-download-btn danger w-full"
                  onClick={() => setConfirmDeleteAsset(selectedAsset)}
                >
                  <Trash2 size={14} />
                  <span>Delete Asset</span>
                </button>
              </div>
            </div>

            {/* Modal Right: Metadata */}
            <div className="results-section project-details-section">
              <h3 className="section-title">Asset Details</h3>
              <div className="project-spec-card">
                <h2 className="project-spec-title" style={{ fontSize: '15px', lineHeight: 1.4 }}>
                  {selectedAsset.prompt}
                </h2>
                <span className="project-status-tag active" style={{ marginTop: 8 }}>
                  {selectedAsset.source === 'history' ? 'Generation Output' : 'Project Media'}
                </span>

                <div className="project-spec-list" style={{ marginTop: 20 }}>
                  <div className="spec-item">
                    <Clock size={13} />
                    <span className="spec-label">Generated:</span>
                    <span className="spec-value">
                      {new Date(selectedAsset.timestamp).toLocaleString()}
                    </span>
                  </div>
                  {selectedAsset.model && (
                    <div className="spec-item">
                      <Sparkles size={13} />
                      <span className="spec-label">Engine / Model:</span>
                      <span className="spec-value">{selectedAsset.model}</span>
                    </div>
                  )}
                  {selectedAsset.sourceName && (
                    <div className="spec-item">
                      <ImageIcon size={13} />
                      <span className="spec-label">Source Project:</span>
                      <span className="spec-value">{selectedAsset.sourceName}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteAsset && (
        <ConfirmModal
          title="Delete Asset"
          message="Are you sure you want to delete this asset from your library? This action cannot be undone."
          confirmLabel="Delete"
          danger
          onConfirm={handleDeleteConfirm}
          onCancel={() => setConfirmDeleteAsset(null)}
        />
      )}
    </div>
  );
};
