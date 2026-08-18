const MODEL_NAME_MAP: Record<string, string> = {
  'bytedance/seedream-5-pro': 'Seedream 5 Pro',
  'bytedance/seedream-4.5': 'Seedream 4.5',
  'google/nano-banana-2': 'Google Nano Banana 2',
  'google/nano-banana-2-lite': 'Google Nano Banana 2 Lite',
  'google/nano-banana': 'Google Nano Banana',
  'krea/krea-2-large': 'Krea 2 Large',
  'openai/gpt-image-2': 'GPT Image 2',
  'openai/dall-e-3': 'DALL·E 3',
  'prunaai/p-image': 'Pruna AI (P-Image)',
  'topazlabs/image-upscale': 'Topaz Labs Upscale',
  'black-forest-labs/flux-1.1-pro': 'FLUX 1.1 Pro',
  'black-forest-labs/flux-schnell': 'FLUX Schnell',
  'black-forest-labs/flux-dev': 'FLUX Dev',
  'stability-ai/sdxl': 'Stable Diffusion XL',
};

function formatModelName(slug: string): string {
  if (!slug) return 'Unknown';
  if (MODEL_NAME_MAP[slug]) return MODEL_NAME_MAP[slug];
  const name = slug.includes('/') ? slug.split('/')[1] : slug;
  return name
    .split(/[-_]/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

import React from 'react';
import { useHistoryStore } from '@/stores/historyStore';
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
    setIsGroupedView,
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
        
        {/* Search Input Container */}
        <div className="history-search-container">
          <div className="history-search-wrapper">
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
        </div>

        {/* Model Dropdown Filter */}
        {uniqueModels.length > 0 && (
          <div className="dropdown-container">
            <SlidersHorizontal size={12} className="dropdown-icon" />
            <select
              className="history-model-select"
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
            >
              <option value="all">All Models ({uniqueModels.length})</option>
              {uniqueModels.map(m => (
                <option key={m} value={m}>{formatModelName(m)}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="history-header-actions">
        {/* View mode toggle: Single cards vs Grouped by source */}
        <button
          className={`sort-btn ${isGroupedView ? 'active' : ''}`}
          onClick={() => setIsGroupedView(!isGroupedView)}
          title={isGroupedView ? "Switch to All Entries View" : "Group Entries by Source Image Workflows"}
        >
          {isGroupedView ? <Grid size={13} /> : <Layers size={13} />}
          <span>{isGroupedView ? 'All Cards' : 'Group Workflows'}</span>
        </button>

        {/* Sort order toggle */}
        <button 
          className="sort-btn" 
          onClick={() => setSortAsc(!sortAsc)}
          title={sortAsc ? "Oldest First" : "Newest First"}
        >
          <ArrowUpDown size={13} />
          <span>{sortAsc ? 'Oldest' : 'Newest'}</span>
        </button>

        {/* Multi-select toggle */}
        <button 
          className={`sort-btn ${selectMode ? 'active' : ''}`}
          onClick={() => setSelectMode(!selectMode)}
          title="Select Multiple Entries"
        >
          <CheckSquare size={13} />
          <span>Select</span>
        </button>

        {/* Collections Pinboard Toggle */}
        <button 
          className={`sort-btn ${showPinboard ? 'active' : ''}`}
          onClick={() => setShowPinboard(!showPinboard)}
          title="Collections & Saved Pinboard Workspace"
        >
          <BookOpen size={13} />
          <span>Collections</span>
        </button>

        {/* Export PDF Button */}
        <button className="sort-btn" onClick={onPdfExportClick} title="Export History as PDF Contact Sheet">
          <span>PDF</span>
        </button>

        {/* Clear All */}
        {entries.length > 0 && (
          <button className="clear-all-btn" onClick={onClearClick} title="Clear All History">
            <Trash2 size={13} />
            <span>Clear All</span>
          </button>
        )}
      </div>
    </div>
  );
};
