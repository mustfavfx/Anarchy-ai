import React, { useState } from 'react';
import { useHistoryStore } from '../stores/historyStore';
import { 
  Search, ArrowUpDown, CheckSquare, BookOpen, Trash2, 
  Sparkles, Layers, Grid, SlidersHorizontal, Loader2
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
    semanticQuery,
    setSemanticQuery,
    selectedModel,
    setSelectedModel,
    sortAsc,
    setSortAsc,
    selectMode,
    setSelectMode,
    isGroupedView,
    setIsGroupedView,
    isSemanticLoading,
    semanticProgress,
    isSemanticModelError
  } = useHistoryStore();

  const [useSemantic, setUseSemantic] = useState(false);

  // Extract unique model names
  const uniqueModels = React.useMemo(() => {
    const models = new Set<string>();
    entries.forEach(e => { if (e.model) models.add(e.model); });
    return Array.from(models).sort();
  }, [entries]);

  const handleSearchChange = (val: string) => {
    if (useSemantic) {
      setSemanticQuery(val);
      setSearchQuery('');
    } else {
      setSearchQuery(val);
      setSemanticQuery('');
    }
  };

  const handleToggleSemantic = () => {
    setUseSemantic(!useSemantic);
    // Clear search values on toggle
    setSearchQuery('');
    setSemanticQuery('');
  };

  return (
    <div className="history-header">
      <div className="header-left-group">
        <h1 className="page-title">History</h1>
        
        {/* Dual Mode Search Input */}
        <div className="history-search-container">
          <div className="history-search">
            <Search size={14} className="search-icon" />
            <input
              type="text"
              placeholder={useSemantic ? "Semantic AI search (e.g. villa)..." : "Search prompt, model..."}
              value={useSemantic ? semanticQuery : searchQuery}
              onChange={e => handleSearchChange(e.target.value)}
            />
            <button 
              className={`search-ai-toggle ${useSemantic ? 'active' : ''}`}
              onClick={handleToggleSemantic}
              title={useSemantic ? "Switch to standard keyword search" : "Switch to semantic AI search"}
            >
              <Sparkles size={12} />
              <span>AI Search</span>
            </button>
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

        {/* Model Loader indicator */}
        {isSemanticLoading && (
          <div className="semantic-loader" title="Downloading AI search model locally (~23MB)...">
            <Loader2 size={13} className="spin" />
            <span>AI Indexing... {semanticProgress ? `${Math.round(semanticProgress.progress || 0)}%` : ''}</span>
          </div>
        )}
        {isSemanticModelError && (
          <div className="semantic-error" title="Could not load AI embedding model. Falling back to keyword search.">
            <span>AI search fallback active</span>
          </div>
        )}
      </div>

      <div className="history-header-actions">
        {/* Visual Grouping Toggles */}
        <div className="group-toggle-bar">
          <button
            className={`sort-btn ${!isGroupedView ? 'active' : ''}`}
            onClick={() => setIsGroupedView(false)}
            title="Show individual renders list"
          >
            <Grid size={13} />
            <span>Flat</span>
          </button>
          <button
            className={`sort-btn ${isGroupedView ? 'active' : ''}`}
            onClick={() => setIsGroupedView(true)}
            title="Group variations by source image"
          >
            <Layers size={13} />
            <span>Grouped</span>
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
