import React from 'react';
import { useHistoryFilters } from '../hooks/useHistoryFilters';
import { useHistoryStore } from '@/stores/historyStore';
import { VirtualHistoryGrid } from './VirtualHistoryGrid';
import type { HistoryEntry } from '../types';
import { Image as ImageIcon } from 'lucide-react';

interface HistoryGridProps {
  onStar: (e: React.MouseEvent, id: string) => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
  onAddToCollection: (e: React.MouseEvent, id: string) => void;
  onOpenWorkflow: (entry: HistoryEntry) => void;
}

export const HistoryGrid: React.FC<HistoryGridProps> = ({
  onStar,
  onDelete,
  onAddToCollection,
  onOpenWorkflow
}) => {
  const { isGroupedView, searchQuery, selectedFilter } = useHistoryStore();
  const { filteredEntries, filteredGroups } = useHistoryFilters();

  const isEmpty = isGroupedView ? filteredGroups.length === 0 : filteredEntries.length === 0;

  if (isEmpty) {
    return (
      <div className="history-empty">
        <ImageIcon size={40} />
        <h3>{searchQuery || selectedFilter !== 'all' ? 'No matching entries' : 'No history yet'}</h3>
        <p>
          {searchQuery || selectedFilter !== 'all'
            ? 'Try different search or filters'
            : 'Generate images in the Builder — they will appear here automatically'}
        </p>
      </div>
    );
  }

  return (
    <div className="history-grid-container">
      <VirtualHistoryGrid
        entries={filteredEntries}
        groups={filteredGroups}
        isGrouped={isGroupedView}
        onStar={onStar}
        onDelete={onDelete}
        onAddToCollection={onAddToCollection}
        onOpenWorkflow={onOpenWorkflow}
      />
    </div>
  );
};
