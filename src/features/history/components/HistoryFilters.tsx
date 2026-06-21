import React from 'react';
import { useHistoryStore } from '@/stores/historyStore';
import type { FilterType } from '../types';

export const HistoryFilters: React.FC = () => {
  const {
    entries,
    collections,
    selectedFilter,
    setSelectedFilter,
    setActiveSmartCollectionId
  } = useHistoryStore();

  // Compute filter counts
  const filterCounts = React.useMemo(() => {
    const counts: Record<string, number> = { all: entries.length };
    entries.forEach(e => {
      if (e.type) counts[e.type] = (counts[e.type] || 0) + 1;
      if (e.starred) counts.starred = (counts.starred || 0) + 1;
    });
    // Sum of manual collections sizes
    counts.pinboard = collections.reduce((sum, c) => sum + c.entryIds.length, 0);
    return counts;
  }, [entries, collections]);

  const FILTERS: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'starred', label: '★ Starred' },
    { key: 'pinboard', label: '📌 Collections' },
    { key: 'render', label: 'Render' },
    { key: 'upscale', label: 'Upscale' },
    { key: 'variation', label: 'Variation' },
    { key: 'edit', label: 'Edit' },
    { key: 'generate', label: 'Generate' },
  ];

  const handleFilterClick = (key: FilterType) => {
    setSelectedFilter(key);
    // Reset smart collection focus if shifting filters
    if (key !== 'pinboard') {
      setActiveSmartCollectionId(null);
    }
  };

  return (
    <div className="history-filters">
      {FILTERS.map(({ key, label }) => {
        const count = filterCounts[key] || 0;
        
        // Hide types if they have no entries (e.g. if we don't have upscales yet)
        if (key !== 'all' && key !== 'starred' && key !== 'pinboard' && count === 0) {
          return null;
        }

        const isActive = selectedFilter === key;

        return (
          <button
            key={key}
            className={`hfilter-chip ${isActive ? 'active' : ''}`}
            onClick={() => handleFilterClick(key)}
          >
            {label}
            {count > 0 && <span className="filter-count">{count}</span>}
          </button>
        );
      })}
    </div>
  );
};
