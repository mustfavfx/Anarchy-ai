import React from 'react';
import type { HistoryGroup, HistoryEntry } from '../types';
import { HistoryCard } from './HistoryCard';
import { X, Layers, Trash2 } from 'lucide-react';

interface GroupExplorerModalProps {
  group: HistoryGroup;
  onClose: () => void;
  onStar: (e: React.MouseEvent, id: string) => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
  onDeleteGroup: (groupId: string) => void;
  onAddToCollection: (e: React.MouseEvent, id: string) => void;
  onOpenWorkflow: (entry: HistoryEntry) => void;
}

export const GroupExplorerModal: React.FC<GroupExplorerModalProps> = ({
  group,
  onClose,
  onStar,
  onDelete,
  onDeleteGroup,
  onAddToCollection,
  onOpenWorkflow
}) => {


  return (
    <div className="history-overlay explorer-overlay">
      <div className="modal-backdrop-close" onClick={onClose} />

      <div className="history-modal group-explorer-modal">
        <button className="modal-close" onClick={onClose}><X size={18} /></button>

        <div className="explorer-header">
          <Layers size={16} className="header-icon" />
          <div className="header-text-group">
            <h3>Group Explorer</h3>
            <span className="header-sub">
              {group.children.length} variations derived from original source
            </span>
          </div>
          <button 
            className="group-delete-btn"
            onClick={() => {
              if (window.confirm("Delete this group and all its variations?")) {
                onDeleteGroup(group.id);
              }
            }}
            title="Delete Group"
            style={{
              marginLeft: 'auto',
              marginRight: 40,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 6,
              background: 'rgba(225, 29, 72, 0.1)',
              color: '#e11d48',
              border: '1px solid rgba(225, 29, 72, 0.2)',
              cursor: 'pointer',
              fontSize: 12
            }}
          >
            <Trash2 size={13} /> Delete Group
          </button>
        </div>

        {/* Scrollable Children Grid */}
        <div className="explorer-grid-container">
          <div className="history-grid explorer-grid">
            {group.children.map(entry => (
              <HistoryCard
                key={entry.id}
                entry={entry}
                isGroup={false}
                onStar={onStar}
                onDelete={onDelete}
                onAddToCollection={onAddToCollection}
                onOpenWorkflow={onOpenWorkflow}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
