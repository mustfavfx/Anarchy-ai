import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHistory } from './hooks/useHistory';
import { useHistorySelection } from './hooks/useHistorySelection';
import { useHistoryStore } from './stores/historyStore';
import { HistoryHeader } from './components/HistoryHeader';
import { HistoryFilters } from './components/HistoryFilters';
import { HistoryGrid } from './components/HistoryGrid';
import { PreviewModal } from './components/PreviewModal';
import { GroupExplorerModal } from './components/GroupExplorerModal';
import { CollectionsSidebar } from './components/CollectionsSidebar';
import { ConfirmModal } from '../../components/ConfirmModal';
import { ExportModal } from '../../components/ExportModal';
import { SESSION_KEYS } from '../../utils/storageKeys';
import type { Collection } from '../../services/history/CollectionService';
import type { HistoryEntry } from './types';
import { 
  X, Check, FolderHeart, Plus, CheckSquare, 
  Square, Download, Trash2, Zap, Clock, Star
} from 'lucide-react';
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
}> = ({ onDeleteClick, onExportZipClick, onExportPdfClick }) => {
  const { selectMode, selectedIds, entries } = useHistoryStore();
  
  if (!selectMode) return null;
  
  const selectedCount = selectedIds.size;
  const totalCount = entries.length;
  const toggleSelectAll = useHistoryStore(s => s.toggleSelectAll);

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

  const {
    selectedIds,
    handleBulkDelete,
    handleBulkExportZip,
    handleBulkExportPDF
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

  const handleOpenWorkflow = (entry: HistoryEntry) => {
    // Save to session cache and redirect to builder
    if (entry.nodeTree) {
      sessionStorage.setItem(SESSION_KEYS.LOADED_WORKFLOW, JSON.stringify(entry.nodeTree));
      navigate('/builder');
    }
  };

  const handleSendToCanvas = (url: string) => {
    sessionStorage.setItem(SESSION_KEYS.PRESET_IMAGE, url);
    navigate('/builder');
  };

  const handleSendGroupToCanvas = (urls: string[]) => {
    if (urls.length === 0) return;
    const timestamp = Date.now();
    const nodes = urls.map((url, index) => {
      const nodeId = `source_${timestamp}_${index}`;
      return {
        id: nodeId,
        type: 'baseNode',
        position: { x: 120, y: 200 + index * 240 },
        data: {
          type: 'source',
          processingType: 'source',
          state: 'ready',
          label: `Source ${index + 1}`,
          image: url,
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
  };

  const handleReusePrompt = (prompt: string, _id: string) => {
    sessionStorage.setItem(SESSION_KEYS.PRESET_PROMPT, prompt);
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

      {/* Bulk Action Header */}
      <BulkActionBar
        onDeleteClick={() => setConfirmBulkDelete(true)}
        onExportZipClick={handleBulkExportZip}
        onExportPdfClick={handleBulkExportPDF}
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
          onOpenExport={(url, name) => setExportTarget({ url, name })}
          onSendToCanvas={handleSendToCanvas}
          onSendGroupToCanvas={handleSendGroupToCanvas}
          onReusePrompt={handleReusePrompt}
        />
      )}

      {/* Group Explorer workspace overlay */}
      {activeGroup && (
        <GroupExplorerModal
          group={activeGroup}
          onClose={() => setActiveGroup(null)}
          onStar={(_, id) => toggleStar(id)}
          onDelete={(_, id) => deleteEntry(id)}
          onAddToCollection={(_, id) => setAddToColEntryId(id)}
          onOpenWorkflow={handleOpenWorkflow}
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
