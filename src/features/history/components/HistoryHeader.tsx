import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useHistoryStore } from '@/stores/historyStore';
import { 
  Search, ArrowUpDown, CheckSquare, BookOpen, Trash2, 
  Layers, Grid, SlidersHorizontal, ChevronDown, Check
} from 'lucide-react';

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

  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    if (!isModelDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
        setIsModelDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isModelDropdownOpen]);

  // Extract unique model names
  const uniqueModels = useMemo(() => {
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

        {/* Custom Anarchy AI Model Dropdown Filter */}
        {uniqueModels.length > 0 && (
          <div className="history-custom-dropdown" ref={modelDropdownRef}>
            <button
              type="button"
              className={`history-dropdown-trigger ${isModelDropdownOpen ? 'active' : ''} ${selectedModel !== 'all' ? 'has-filter' : ''}`}
              onClick={() => setIsModelDropdownOpen(prev => !prev)}
            >
              <SlidersHorizontal size={13} className="dropdown-icon" />
              <span className="dropdown-trigger-text">
                {selectedModel === 'all' ? `All Models (${uniqueModels.length})` : formatModelName(selectedModel)}
              </span>
              <ChevronDown size={13} className={`dropdown-chevron ${isModelDropdownOpen ? 'open' : ''}`} />
            </button>

            {isModelDropdownOpen && (
              <div className="history-dropdown-menu">
                <button
                  type="button"
                  className={`history-dropdown-item ${selectedModel === 'all' ? 'selected' : ''}`}
                  onClick={() => { setSelectedModel('all'); setIsModelDropdownOpen(false); }}
                >
                  <span className="item-label">All Models</span>
                  <span className="item-count">({uniqueModels.length})</span>
                  {selectedModel === 'all' && <Check size={13} className="item-check" />}
                </button>

                <div className="history-dropdown-divider" />

                {uniqueModels.map(m => (
                  <button
                    key={m}
                    type="button"
                    className={`history-dropdown-item ${selectedModel === m ? 'selected' : ''}`}
                    onClick={() => { setSelectedModel(m); setIsModelDropdownOpen(false); }}
                  >
                    <span className="item-label">{formatModelName(m)}</span>
                    {selectedModel === m && <Check size={13} className="item-check" />}
                  </button>
                ))}
              </div>
            )}
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

        {/* Pinboard toggle */}
        <button 
          className={`sort-btn ${showPinboard ? 'active' : ''}`}
          onClick={() => setShowPinboard(!showPinboard)}
          title="View PDF Export Layout"
        >
          <BookOpen size={13} />
          <span>Pinboard</span>
        </button>

        {/* Clear history */}
        <button 
          className="clear-btn" 
          onClick={onClearClick}
          title="Clear all generated history"
        >
          <Trash2 size={13} />
          <span>Clear</span>
        </button>
      </div>
    </div>
  );
};
