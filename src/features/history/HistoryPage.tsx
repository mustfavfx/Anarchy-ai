import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHistory } from './hooks/useHistory';
import { useHistorySelection } from './hooks/useHistorySelection';
import { useHistoryStore } from '@/stores/historyStore';
import { useHistoryRestore } from './hooks/useHistoryRestore';
import { buildWorkflowTreeForEntry, type HistoryTreeNode } from './components/WorkflowTreeRenderer';
import type { NodeTreeData } from '@/types/history';
import { HistoryHeader } from './components/HistoryHeader';
import { HistoryFilters } from './components/HistoryFilters';
import { HistoryGrid } from './components/HistoryGrid';
import { HistoryMetricsBar } from './components/HistoryMetricsBar';
import { PreviewModal } from './components/PreviewModal';
import { GroupExplorerModal } from './components/GroupExplorerModal';
import { CollectionsSidebar } from './components/CollectionsSidebar';
import { ConfirmModal } from '../../shared/components/ConfirmModal';
import { ExportModal } from '../../shared/components/ExportModal';
import { downloadImage, isVideoUrl } from '../../utils/imageExport';
import { SESSION_KEYS } from '../../utils/storageKeys';
import type { Collection } from '../../services/history/CollectionService';
import type { HistoryEntry } from './types';
import { 
  X, Check, FolderHeart, Plus, CheckSquare, 
  Square, Download, Trash2, Zap, Clock, Star
} from 'lucide-react';
import { getHistoryNodeLabel } from '@/utils/nodeLabel';
import './HistoryPage.css';

/* ════════════════════════════════════════════════════════════════════
   STATS ROW
   ════════════════════════════════════════════════════════════════════ */
const StatsRow: React.FC = () => {
  const { stats } = useHistoryStore();
  if (stats.total === 0) return null;
  return (
    <div className="history-stats">
      <div className="hstat"><Zap size={14} className="hstat-icon" /><span className="hstat-val">{stats.total}</span><span className="hstat-label">Total</span></div>
      <div className="hstat"><Clock size={14} className="hstat-icon" /><span className="hstat-val">{stats.todayCount}</span><span className="hstat-label">Today</span></div>
      <div className="hstat"><Star size={14} className="hstat-icon" /><span className="hstat-val">{stats.starred}</span><span className="hstat-label">Starred</span></div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════════
   BULK ACTION BAR
   ════════════════════════════════════════════════════════════════════ */
const BulkActionBar: React.FC<{
  onDeleteClick: () => void;
  onExportZipClick: () => void;
  onExportPdfClick: () => void;
  onExportFolderClick: () => void;
}> = ({ onDeleteClick, onExportZipClick, onExportPdfClick, onExportFolderClick }) => {
  const { selectMode, selectedIds, entries } = useHistoryStore();
  const toggleSelectAll = useHistoryStore(s => s.toggleSelectAll);
  
  if (!selectMode) return null;
  
  const selectedCount = selectedIds.size;
  const totalCount = entries.length;

  const handleToggleAll = () => {
    toggleSelectAll(entries.map(e => e.id));
  };

  return (
    <div className="bulk-action-bar">
      <button className="bulk-select-all" onClick={handleToggleAll}>
        {selectedCount === totalCount ? <><CheckSquare size={14} /> Deselect All</> : <><Square size={14} /> Select All</>}
      </button>
      <span className="bulk-count">{selectedCount} selected</span>
      <div className="bulk-actions">
        <button className="bulk-btn" onClick={onExportFolderClick} disabled={selectedCount === 0}><Download size={14} /> Save to Folder</button>
        <button className="bulk-btn" onClick={onExportZipClick} disabled={selectedCount === 0}><Download size={14} /> ZIP</button>
        <button className="bulk-btn" onClick={onExportPdfClick} disabled={selectedCount === 0}><Download size={14} /> PDF</button>
        <button className="bulk-btn danger" onClick={onDeleteClick} disabled={selectedCount === 0}><Trash2 size={14} /> Delete ({selectedCount})</button>
      </div>
    </div>
  );
};

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
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════════ */
export const HistoryPage: React.FC = () => {
  const navigate = useNavigate();

  // Initialize and synchronize history hooks & store cache
  const {
    entries,
    collections,
    previewEntry,
    setPreviewEntry,
    activeGroup,
    setActiveGroup,
    toggleStar,
    deleteEntry,
    clearAllHistory,
    createCollection,
    addEntryToCollection,
    removeEntryFromCollection
  } = useHistory();

  // HistoryEngine v3.1 safe restore pipeline (Validate → Repair → SessionManager → Navigate)
  const { restore: restoreViaEngine } = useHistoryRestore();

  const {
    selectedIds,
    handleBulkDelete,
    handleBulkExportZip,
    handleBulkExportPDF,
    handleBulkExportFolder
  } = useHistorySelection();

  const [showPinboard, setShowPinboard] = useState(false);
  const [addToColEntryId, setAddToColEntryId] = useState<string | null>(null);
  
  // Modals confirmation states
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [exportTarget, setExportTarget] = useState<{ url: string; name: string } | null>(null);

  // Workflow navigation chevrons calculation
  const previewIndex = previewEntry ? entries.findIndex(e => e.id === previewEntry.id) : -1;
  const hasPrev = previewIndex > 0;
  const hasNext = previewIndex >= 0 && previewIndex < entries.length - 1;

  const handleNavigate = (dir: 'next' | 'prev') => {
    if (!previewEntry) return;
    const nextIdx = dir === 'next' ? previewIndex + 1 : previewIndex - 1;
    if (nextIdx >= 0 && nextIdx < entries.length) {
      setPreviewEntry(entries[nextIdx]);
    }
  };

  const handleOpenWorkflow = async (entry: HistoryEntry) => {
    try {
      await restoreViaEngine(entry);
    } catch (err) {
      console.error('[HistoryPage] Failed to restore workflow:', err);
    }
  };

  // ── Send to Canvas via HistoryEngine v3.1 RestorePipeline ──────────────────
  // Pipeline: GraphValidation → AutoRepair → CanvasSessionManager → navigate('/builder')
  const handleSendToCanvas = useCallback(async (url: string, entry: HistoryEntry) => {
    try {
      // Attempt engine restore (validates graph, repairs, sets session, navigates)
      const success = await restoreViaEngine(entry);
      if (success) return;

      // Fallback: image-only send via legacy CanvasHandoffService
      let imageData = url;
      if (url.startsWith('blob:')) {
        const res = await fetch(url);
        const blob = await res.blob();
        imageData = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }

      const { CanvasHandoffService } = await import('@/services/canvas/CanvasHandoffService');
      const nodeLabel = getHistoryNodeLabel(entry);
      const promptText = entry.prompt || entry.params?.prompt || '';
      CanvasHandoffService.setPending({
        kind: 'image',
        image: imageData,
        source: entry.id ? `history:${entry.id}` : 'history',
        label: nodeLabel,
        prompt: promptText,
        model: entry.model || entry.params?.model || '',
      });
      navigate('/builder');
    } catch (err) {
      console.error('[HistoryPage] handleSendToCanvas failed:', err);
      navigate('/builder');
    }
  }, [restoreViaEngine, navigate]);


  const handleSendGroupToCanvas = async (urls: string[]) => {
    if (urls.length === 0) return;
    try {
      // Convert all blob URLs to base64 before navigation (same reasoning as above)
      const imageDatas = await Promise.all(
        urls.map(async (url, _i) => {
          if (!url.startsWith('blob:')) return url;
          const res = await fetch(url);
          const blob = await res.blob();
          return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        })
      );

      navigate('/builder');

      // Stagger events so each source node gets positioned independently
      imageDatas.forEach((imageData, index) => {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('anarchy:external-image-global', {
            detail: {
              image: imageData,
              source: `history-group:${index}`,
            }
          }));
        }, 80 + index * 220);
      });
    } catch (err) {
      console.error('[HistoryPage] handleSendGroupToCanvas failed:', err);
      navigate('/builder');
    }
  };

  const handleReusePrompt = (prompt: string, id: string) => {
    sessionStorage.setItem(SESSION_KEYS.PRESET_PROMPT, prompt);
    if (id) {
      sessionStorage.setItem('presetParentId', id);
      const entry = entries.find(e => e.id === id);
      if (entry?.rootId) {
        sessionStorage.setItem('presetRootId', entry.rootId);
      } else if (entry?.rootSourceId) {
        sessionStorage.setItem('presetRootId', entry.rootSourceId);
      } else if (entry) {
        sessionStorage.setItem('presetRootId', entry.id);
      }
    }
    navigate('/builder');
  };

  return (
    <div className="history-page">
      {/* Page Header */}
      <HistoryHeader
        onClearClick={() => setConfirmClear(true)}
        onPdfExportClick={handleBulkExportPDF}
        showPinboard={showPinboard}
        setShowPinboard={setShowPinboard}
      />

      {/* Statistics */}
      <StatsRow />

      {/* Live Analytics — generation metrics, duration, model usage */}
      <HistoryMetricsBar entries={entries} />

      {/* Bulk Action Header */}
      <BulkActionBar
        onDeleteClick={() => setConfirmBulkDelete(true)}
        onExportZipClick={handleBulkExportZip}
        onExportPdfClick={handleBulkExportPDF}
        onExportFolderClick={handleBulkExportFolder}
      />

      {/* Dynamic Channels Filter Bar */}
      <HistoryFilters />


      {/* Main Grid View Area */}
      <div className={`history-layout ${showPinboard ? 'with-sidebar' : ''}`}>
        <HistoryGrid
          onStar={(e, id) => { e.stopPropagation(); toggleStar(id); }}
          onDelete={(e, id) => { e.stopPropagation(); deleteEntry(id); }}
          onAddToCollection={(e, id) => { e.stopPropagation(); setAddToColEntryId(id); }}
          onOpenWorkflow={handleOpenWorkflow}
        />

        {/* Collections Pinboard Workspace Sidebar */}
        {showPinboard && (
          <CollectionsSidebar onClose={() => setShowPinboard(false)} />
        )}
      </div>

      {/* Group Explorer workspace overlay */}
      {activeGroup && (
        <GroupExplorerModal
          group={activeGroup}
          onClose={() => setActiveGroup(null)}
          onStar={(_, id) => toggleStar(id)}
          onDelete={(_, id) => deleteEntry(id)}
          onDeleteGroup={async (groupId) => {
            setActiveGroup(null);
            await useHistoryStore.getState().deleteGroup(groupId);
          }}
          onAddToCollection={(_, id) => setAddToColEntryId(id)}
          onOpenWorkflow={(entry) => {
            setActiveGroup(null);
            handleOpenWorkflow(entry);
          }}
        />
      )}

      {/* Image Preview Modal Overlay */}
      {previewEntry && (
        <PreviewModal
          preview={previewEntry}
          onClose={() => setPreviewEntry(null)}
          onNavigate={handleNavigate}
          hasPrev={hasPrev}
          hasNext={hasNext}
          onStar={(_, id) => toggleStar(id)}
          onOpenWorkflow={handleOpenWorkflow}
          onOpenExport={(url, name) => {
            if (isVideoUrl(url)) {
              downloadImage(url, name, { isVideo: true });
            } else {
              setExportTarget({ url, name });
            }
          }}
          onSendToCanvas={handleSendToCanvas}
          onSendGroupToCanvas={handleSendGroupToCanvas}
          onReusePrompt={handleReusePrompt}
          onPreviewChange={setPreviewEntry}
        />
      )}

      {/* Add To Collection Modal */}
      {addToColEntryId && (
        <AddToCollectionModal
          entryId={addToColEntryId}
          collections={collections}
          onAddToNew={createCollection}
          onAddTo={(colId) => addEntryToCollection(colId, addToColEntryId)}
          onRemoveFrom={(colId) => removeEntryFromCollection(colId, addToColEntryId)}
          onClose={() => setAddToColEntryId(null)}
        />
      )}

      {/* Export Target Image Modal */}
      {exportTarget && (
        <ExportModal 
          imageUrl={exportTarget.url} 
          imageName={exportTarget.name} 
          onClose={() => setExportTarget(null)} 
        />
      )}

      {/* Clear All Confirmation Modal */}
      {confirmClear && (
        <ConfirmModal 
          title="Clear All History" 
          message="Clear all history and database images? This action cannot be undone." 
          confirmLabel="Clear All" 
          danger 
          onConfirm={async () => { setConfirmClear(false); await clearAllHistory(); }} 
          onCancel={() => setConfirmClear(false)} 
        />
      )}

      {/* Delete Selection Confirmation Modal */}
      {confirmBulkDelete && (
        <ConfirmModal 
          title="Delete Selected" 
          message={`Delete the ${selectedIds.size} selected item${selectedIds.size === 1 ? '' : 's'}?`} 
          confirmLabel={`Delete ${selectedIds.size}`} 
          danger 
          onConfirm={async () => { setConfirmBulkDelete(false); await handleBulkDelete(); }} 
          onCancel={() => setConfirmBulkDelete(false)} 
        />
      )}
    </div>
  );
};
export default HistoryPage;
