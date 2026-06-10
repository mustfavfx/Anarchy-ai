import React from 'react';
import type { HistoryGroup, HistoryEntry } from '../types';
import { HistoryCard } from './HistoryCard';
import { X, Layers } from 'lucide-react';

interface GroupExplorerModalProps {
  group: HistoryGroup;
  onClose: () => void;
  onStar: (e: React.MouseEvent, id: string) => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
  onAddToCollection: (e: React.MouseEvent, id: string) => void;
  onOpenWorkflow: (entry: HistoryEntry) => void;
}

export const GroupExplorerModal: React.FC<GroupExplorerModalProps> = ({
  group,
  onClose,
  onStar,
  onDelete,
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
