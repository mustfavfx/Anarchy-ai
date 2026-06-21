import React from 'react';

import type { HistoryEntry, HistoryGroup } from '../types';
import { useLazyImage } from '../hooks/useLazyImage';
import { useHistoryStore } from '@/stores/historyStore';
import { 
  CheckSquare, Square, Star, FolderOpen, Eye, 
  Trash2, BookmarkPlus, ChevronsLeftRight, Timer, Layers,
  Image as ImageIcon
} from 'lucide-react';
import { formatDuration, getDateLabel } from '@/services/history/HistoryService';

interface HistoryCardProps {
  entry?: HistoryEntry;
  group?: HistoryGroup;
  isGroup?: boolean;
  onStar: (e: React.MouseEvent, id: string) => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
  onAddToCollection: (e: React.MouseEvent, id: string) => void;
  onOpenWorkflow: (entry: HistoryEntry) => void;
}

export const HistoryCard: React.FC<HistoryCardProps> = ({
  entry,
  group,
  isGroup = false,
  onStar,
  onDelete,
  onAddToCollection,
  onOpenWorkflow
}) => {
  const {
    selectMode,
    selectedIds,
    toggleSelectId,
    setPreviewEntry,
    setActiveGroup,
    collections
  } = useHistoryStore();

  // Determine target ID and slot for lazy image loading
  const targetId = isGroup ? group!.sourceImageId : entry!.id;

  // containerRef is a callback ref — attach it directly to the root div
  const { containerRef, src: imageSrc, isLoading, error } = useLazyImage(targetId, isGroup ? 'root_source' : 'output');
  
  const isSelected = isGroup
    ? Array.from(selectedIds).some(id => group!.children.some(c => c.id === id))
    : selectedIds.has(entry!.id);
    
  const isStarred = isGroup
    ? group!.children.some(c => c.starred)
    : entry!.starred || false;

  // Check if entry or group is in any collection
  const isInAnyCollection = React.useMemo(() => {
    if (isGroup) {
      return group!.children.some(c => collections.some(col => col.entryIds.includes(c.id)));
    }
    return collections.some(col => col.entryIds.includes(entry!.id));
  }, [collections, isGroup, entry, group]);

  const handleCardClick = () => {
    if (selectMode) {
      if (isGroup) {
        // Toggle selection for all children in the group
        const groupIds = group!.children.map(c => c.id);
        const allSelected = groupIds.every(id => selectedIds.has(id));
        groupIds.forEach(id => {
          if (allSelected && selectedIds.has(id)) {
            toggleSelectId(id);
          } else if (!allSelected && !selectedIds.has(id)) {
            toggleSelectId(id);
          }
        });
      } else {
        toggleSelectId(entry!.id);
      }
    } else {
      if (isGroup) {
        setActiveGroup(group!);
      } else {
        setPreviewEntry(entry!);
      }
    }
  };

  if (isGroup) {
    const mainEntry = group!.children[0] || entry;
    const variantsCount = group!.children.length;

    return (
      <div
        ref={containerRef}
        className={`history-grid-item group-card ${isLoading ? 'skeleton-card' : ''} ${isSelected ? 'selected' : ''}`}
        onClick={handleCardClick}
      >
        {isLoading ? (
          <>
            <div className="grid-image-container skeleton-image">
              <div className="skeleton-shimmer" />
            </div>
            <div className="grid-item-info">
              <div className="skeleton-line sk-prompt" />
              <div className="skeleton-meta-row">
                <div className="skeleton-line sk-model" />
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="grid-image-container single-image">
              {error || !imageSrc ? (
                <div className="grid-img-error">
                  <ImageIcon size={24} style={{ opacity: 0.25, color: '#ffffff' }} />
                </div>
              ) : (
                <img src={imageSrc} alt={mainEntry.label} className="grid-img-out" loading="lazy" />
              )}
              
              {/* Group Overlay Badge */}
              <div className="group-variants-badge">
                <Layers size={10} />
                <span>{variantsCount} Result{variantsCount === 1 ? '' : 's'}</span>
              </div>

              {isInAnyCollection && (
                <div className="collection-badge"><BookmarkPlus size={10} /></div>
              )}
            </div>

            <div className="grid-item-info">
              <span className="grid-item-prompt">{mainEntry.prompt || mainEntry.label}</span>
              <div className="grid-item-meta">
                <span className="grid-item-model">
                  {mainEntry.model ? mainEntry.model.split(' ').slice(0, 2).join(' ') : 'Group'}
                </span>
                <span className="grid-item-date">{getDateLabel(group!.lastModified)}</span>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // Flat mode single card
  const hasBothImages = !!entry!.inputImage || !!entry!.outputImage; // Checked during runtime objectUrl resolves

  return (
    <div
      ref={containerRef}
      className={`history-grid-item ${isLoading ? 'skeleton-card' : ''} ${isStarred ? 'starred' : ''} ${isSelected ? 'selected' : ''}`}
      onClick={handleCardClick}
    >
      {isLoading ? (
        <>
          <div className="grid-image-container skeleton-image">
            <div className="skeleton-shimmer" />
          </div>
          <div className="grid-item-info">
            <div className="skeleton-line sk-prompt" />
            <div className="skeleton-meta-row">
              <div className="skeleton-line sk-model" />
              <div className="skeleton-line sk-date" />
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="grid-image-container single-image">
            {error || !imageSrc ? (
              <div className="grid-img-error">
                <ImageIcon size={24} style={{ opacity: 0.25, color: '#ffffff' }} />
              </div>
            ) : (
              <img src={imageSrc} alt={entry!.label} className="grid-img-out" loading="lazy" />
            )}

            {selectMode && (
              <div className="item-select-check">
                {selectedIds.has(entry!.id) ? <CheckSquare size={15} color="#e11d48" /> : <Square size={15} />}
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
                <button className="grid-action-btn" onClick={(e) => { e.stopPropagation(); onOpenWorkflow(entry!); }} title="Use (Workflow)"><FolderOpen size={12} /></button>
                <button className="grid-action-btn" onClick={(e) => { e.stopPropagation(); setPreviewEntry(entry!); }} title="View Details"><Eye size={12} /></button>
                <button className={`grid-action-btn ${isStarred ? 'star-active' : ''}`} onClick={(e) => onStar(e, entry!.id)} title={isStarred ? 'Unstar' : 'Star'}><Star size={12} fill={isStarred ? '#e11d48' : 'none'} /></button>
                <button className={`grid-action-btn ${isInAnyCollection ? 'star-active' : ''}`} onClick={(e) => onAddToCollection(e, entry!.id)} title="Add to Collection"><BookmarkPlus size={12} /></button>
                <button className="grid-action-btn" onClick={(e) => onDelete(e, entry!.id)} title="Delete"><Trash2 size={12} /></button>
              </div>
            )}
          </div>

          <div className="grid-item-info">
            <span className="grid-item-prompt">{entry!.prompt || entry!.label}</span>
            <div className="grid-item-meta">
              <span className="grid-item-model">
                {entry!.model ? entry!.model.split(' ').slice(0, 2).join(' ') : entry!.type}
              </span>
              <div className="grid-item-right-meta">
                {entry!.duration && entry!.duration > 0 && (
                  <span className="grid-item-duration">
                    <Timer size={9} />
                    {formatDuration(entry!.duration)}
                  </span>
                )}
                <span className="grid-item-date">{getDateLabel(entry!.timestamp)}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
