import React from 'react';
import { useHistoryStore } from '../stores/historyStore';
import { 
  Search, ArrowUpDown, CheckSquare, BookOpen, Trash2, 
  Layers, Grid, SlidersHorizontal
} from 'lucide-react';

interface HistoryHeaderProps {
  onClearClick: () => void;
  onPdfExportClick: () => void;
  showPinboard: boolean;
  setShowPinboard: (show: boolean) => void;
}

export const HistoryHeader: React.FC<HistoryHeaderProps> = ({
  onClearClick,
  onPdfExportClick,
  showPinboard,
  setShowPinboard
}) => {
  const {
    entries,
    searchQuery,
    setSearchQuery,
    selectedModel,
    setSelectedModel,
    sortAsc,
    setSortAsc,
    selectMode,
    setSelectMode,
    isGroupedView,
    setIsGroupedView
  } = useHistoryStore();

  // Extract unique model names
  const uniqueModels = React.useMemo(() => {
    const models = new Set<string>();
    entries.forEach(e => { if (e.model) models.add(e.model); });
    return Array.from(models).sort();
  }, [entries]);

  return (
    <div className="history-header">
      <div className="header-left-group">
        <h1 className="page-title">History</h1>
        
        {/* Search Input */}
        <div className="history-search-container">
          <div className="history-search">
            <Search size={14} className="search-icon" />
            <input
              type="text"
              placeholder="Search prompt, model..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Model Dropdown Filter */}
        {uniqueModels.length > 0 && (
          <div className="dropdown-container">
            <SlidersHorizontal size={12} className="dropdown-icon" />
            <select
              className="history-model-select"
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
              title="Filter by model"
            >
              <option value="all">All Models</option>
              {uniqueModels.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="history-header-actions">
        {/* Visual Grouping Toggles */}
        <div className="group-toggle-bar">
          <button
            className={`sort-btn ${!isGroupedView ? 'active' : ''}`}
            onClick={() => setIsGroupedView(false)}
            title="Flat View"
          >
            <Grid size={13} />
          </button>
          <button
            className={`sort-btn ${isGroupedView ? 'active' : ''}`}
            onClick={() => setIsGroupedView(true)}
            title="Grouped View"
          >
            <Layers size={13} />
          </button>
        </div>

        {/* List Sorting */}
        <button className="sort-btn" onClick={() => setSortAsc(!sortAsc)} title={sortAsc ? "Sort Oldest first" : "Sort Newest first"}>
          <ArrowUpDown size={13} />
          <span>{sortAsc ? 'Oldest' : 'Newest'}</span>
        </button>

        {/* Selection mode */}
        {entries.length > 0 && (
          <button
            className={`sort-btn ${selectMode ? 'active' : ''}`}
            onClick={() => setSelectMode(!selectMode)}
            title="Select items for bulk operations"
          >
            <CheckSquare size={13} />
            <span>Select</span>
          </button>
        )}

        {/* Collections sidebar toggle */}
        <button
          className={`sort-btn ${showPinboard ? 'active' : ''}`}
          onClick={() => setShowPinboard(!showPinboard)}
          title="Toggle Collections sidebar"
        >
          <BookOpen size={13} />
          <span>Collections</span>
        </button>

        {/* PDF export */}
        {entries.length > 0 && (
          <button className="sort-btn" onClick={onPdfExportClick} title="Export to PDF format">
            <span>PDF</span>
          </button>
        )}

        {/* Clear all */}
        {entries.length > 0 && (
          <button className="clear-all-btn" onClick={onClearClick} title="Clear all history entries">
            <Trash2 size={13} />
            <span>Clear All</span>
          </button>
        )}
      </div>
    </div>
  );
};
