import React, { useState, useEffect, useRef, useMemo } from 'react';
import { List } from 'react-window';
const AnyList = List as React.ComponentType<any>;
import type { HistoryEntry, HistoryGroup } from '../types';
import { HistoryCard } from './HistoryCard';

interface VirtualHistoryGridProps {
  entries: HistoryEntry[];
  groups: HistoryGroup[];
  isGrouped: boolean;
  onStar: (e: React.MouseEvent, id: string) => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
  onAddToCollection: (e: React.MouseEvent, id: string) => void;
  onOpenWorkflow: (entry: HistoryEntry) => void;
}

export const VirtualHistoryGrid: React.FC<VirtualHistoryGridProps> = ({
  entries,
  groups,
  isGrouped,
  onStar,
  onDelete,
  onAddToCollection,
  onOpenWorkflow
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 1000, height: 600 });

  // Measure container width and height responsively
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const resizeObserver = new ResizeObserver((entries) => {
      if (entries && entries[0]) {
        const { width, height } = entries[0].contentRect;
        setDimensions({
          width: width > 0 ? width : 1000,
          height: height > 0 ? height : 600,
        });
      }
    });

    resizeObserver.observe(el);
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const cardWidth = 240;
  const gap = 16;
  
  // Calculate dynamic column count based on container width
  const columnsCount = useMemo(() => {
    const cols = Math.floor((dimensions.width + gap) / (cardWidth + gap));
    return Math.max(1, cols);
  }, [dimensions.width]);

  // Dynamic grid data
  const gridItems = isGrouped ? groups : entries;
  const rowCount = Math.ceil(gridItems.length / columnsCount);
  const rowHeight = isGrouped ? 275 : 295; // Custom height for cards + info block

  // Virtual Row Renderer
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const startIndex = index * columnsCount;
    const rowItems = [];
    
    for (let i = 0; i < columnsCount; i++) {
      const itemIndex = startIndex + i;
      if (itemIndex < gridItems.length) {
        rowItems.push(gridItems[itemIndex]);
      }
    }

    return (
      <div 
        style={{ 
          ...style, 
          display: 'flex', 
          gap: `${gap}px`,
          paddingLeft: '4px',
          paddingRight: '4px',
          boxSizing: 'border-box'
        }}
      >
        {rowItems.map((item) => {
          if (isGrouped) {
            const groupItem = item as HistoryGroup;
            return (
              <div key={groupItem.id} style={{ width: `${cardWidth}px`, flexShrink: 0 }}>
                <HistoryCard
                  group={groupItem}
                  isGroup={true}
                  onStar={onStar}
                  onDelete={onDelete}
                  onAddToCollection={onAddToCollection}
                  onOpenWorkflow={onOpenWorkflow}
                />
              </div>
            );
          } else {
            const entryItem = item as HistoryEntry;
            return (
              <div key={entryItem.id} style={{ width: `${cardWidth}px`, flexShrink: 0 }}>
                <HistoryCard
                  entry={entryItem}
                  isGroup={false}
                  onStar={onStar}
                  onDelete={onDelete}
                  onAddToCollection={onAddToCollection}
                  onOpenWorkflow={onOpenWorkflow}
                />
              </div>
            );
          }
        })}
      </div>
    );
  };



  return (
    <div 
      ref={containerRef} 
      className="virtual-history-grid-wrapper"
      style={{ width: '100%', height: 'calc(100vh - 200px)', minHeight: '300px' }}
    >
      {gridItems.length === 0 ? (
        <div className="history-empty">
          <h3>No matches found</h3>
        </div>
      ) : (
        <AnyList
          rowCount={rowCount}
          rowHeight={rowHeight + gap}
          rowComponent={Row}
          rowProps={{}}
          style={{ width: '100%', height: `${dimensions.height}px`, overflowX: 'hidden' }}
        />
      )}
    </div>
  );
};
