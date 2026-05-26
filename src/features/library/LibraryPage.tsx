import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Download, Image as ImageIcon, Loader2, Eye, X, Send, Layers } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { ExportModal } from '../../components/ExportModal';
import { getHistory, type HistoryEntry } from '../../services/history/HistoryService';
import { SESSION_KEYS } from '../../utils/storageKeys';
import './LibraryPage.css';

// A source group containing the source image and all its generated results
interface SourceGroup {
  id: string;
  sourceImage: string;
  sourcePrompt?: string;
  results: ResultItem[];
  createdAt: number;
  project?: string;
}

interface ResultItem {
  id: string;
  image: string;
  prompt?: string;
  type: string;
  createdAt: number;
  historyId: string;
}


export const LibraryPage: React.FC = () => {
  const navigate = useNavigate();
  const [sourceGroups, setSourceGroups] = useState<SourceGroup[]>([]);
  const [search, setSearch] = useState('');
  // Filter feature can be added later - currently showing all sources
  const [loading, setLoading] = useState(true);
  const [selectedSource, setSelectedSource] = useState<SourceGroup | null>(null);
  const [exportTarget, setExportTarget] = useState<{ image: string; name: string } | null>(null);

  // Group history entries by source image
  const loadSourceGroups = useCallback(async () => {
    setLoading(true);
    try {
      const historyEntries = getHistory();
      const sourceMap = new Map<string, SourceGroup>();
      
      for (const entry of historyEntries) {
        const sourceKey = entry.inputImage || 'no-source';
        
        // Create or get source group
        if (!sourceMap.has(sourceKey)) {
          sourceMap.set(sourceKey, {
            id: `source-${entry.id}`,
            sourceImage: sourceKey === 'no-source' ? entry.outputImage! : sourceKey,
            sourcePrompt: entry.prompt,
            results: [],
            createdAt: entry.timestamp,
            project: entry.project,
          });
        }
        
        // Add result to the source group
        const group = sourceMap.get(sourceKey)!;
        if (entry.outputImage && entry.outputImage !== sourceKey) {
          group.results.push({
            id: `result-${entry.id}`,
            image: entry.outputImage,
            prompt: entry.prompt,
            type: entry.type,
            createdAt: entry.timestamp,
            historyId: entry.id,
          });
        }
      }
      
      // Convert to array and sort by date
      const groups = Array.from(sourceMap.values())
        .filter(g => g.results.length > 0) // Only show sources with results
        .sort((a, b) => b.createdAt - a.createdAt);
      
      setSourceGroups(groups);
    } catch (err) {
      console.error('[Library] Load failed:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadSourceGroups(); }, [loadSourceGroups]);

  // Reload when history changes
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'anarchy_history') loadSourceGroups();
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [loadSourceGroups]);

  // Filter source groups by search
  const filtered = sourceGroups.filter(group => {
    if (search && !group.sourcePrompt?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleExport = (e: React.MouseEvent, image: string, name: string) => {
    e.stopPropagation();
    setExportTarget({ image, name });
  };

  const handleSendToCanvas = (e: React.MouseEvent, image: string, prompt?: string) => {
    e.stopPropagation();
    sessionStorage.setItem(SESSION_KEYS.PRESET_IMAGE, image);
    if (prompt) sessionStorage.setItem(SESSION_KEYS.PRESET_PROMPT, prompt);
    navigate('/builder');
  };

  return (
    <div className="library-page">
      <div className="library-controls">
        <div className="header-left-group">
          <h1 className="page-title">Library</h1>
          <div className="library-search">
            <Search size={14} />
            <input
              type="text"
              placeholder="Search assets..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="library-stats">
            <span className="stats-text">{filtered.length} source{filtered.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <div className="library-stats">
          <span className="stats-text">{filtered.length} asset{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {loading ? (
        <div className="library-loading">
          <Loader2 size={24} className="spin" />
          <span>Scanning projects...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="library-empty">
          <ImageIcon size={40} />
          <h3>{search ? 'No matching sources' : 'Library is empty'}</h3>
          <p>{search ? 'Try different search terms' : 'Generate images in the Builder to see them here'}</p>
        </div>
      ) : (
        <div className="assets-grid">
          {filtered.map(group => (
            <div
              key={group.id}
              className="asset-card source-card"
              onClick={() => setSelectedSource(group)}
            >
              <div className="asset-image-box">
                <img src={group.sourceImage} alt="Source" loading="lazy" />
                <div className="asset-type-tag source">
                  Source
                </div>
                <div className="result-count-badge">
                  <Layers size={12} />
                  <span>{group.results.length} results</span>
                </div>
                <div className="asset-hover-actions">
                  <button className="asset-action-btn" onClick={(e) => { e.stopPropagation(); setSelectedSource(group); }} title="View Results">
                    <Eye size={14} />
                  </button>
                  <button className="asset-action-btn" onClick={(e) => handleSendToCanvas(e, group.sourceImage, group.sourcePrompt)} title="Send to Canvas">
                    <Send size={14} />
                  </button>
                </div>
              </div>
              <div className="asset-details">
                <h4 className="asset-name">{group.sourcePrompt?.slice(0, 40) || 'Source Image'}{group.sourcePrompt && group.sourcePrompt.length > 40 ? '...' : ''}</h4>
                <p className="asset-project">{group.results.length} generated results</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Source & Results Modal */}
      {selectedSource && (
        <div className="library-preview-overlay" onClick={() => setSelectedSource(null)}>
          <div className="library-preview-modal results-modal" onClick={e => e.stopPropagation()}>
            <button className="preview-close" onClick={() => setSelectedSource(null)}>
              <X size={18} />
            </button>
            
            {/* Source Section */}
            <div className="source-section">
              <h3 className="section-title">Source Image</h3>
              <div className="source-image-wrap">
                <img src={selectedSource.sourceImage} alt="Source" />
              </div>
              {selectedSource.sourcePrompt && (
                <p className="source-prompt">{selectedSource.sourcePrompt}</p>
              )}
              <div className="source-actions">
                <button className="preview-download-btn" onClick={(e) => handleSendToCanvas(e, selectedSource.sourceImage, selectedSource.sourcePrompt)}>
                  <Send size={14} />
                  <span>Send to Canvas</span>
                </button>
                <button className="preview-download-btn" onClick={(e) => handleExport(e, selectedSource.sourceImage, 'source-image')}>
                  <Download size={14} />
                  <span>Export Source</span>
                </button>
              </div>
            </div>
            
            {/* Results Grid */}
            <div className="results-section">
              <h3 className="section-title">Generated Results ({selectedSource.results.length})</h3>
              <div className="results-grid">
                {selectedSource.results.map(result => (
                  <div key={result.id} className="result-item">
                    <div className="result-image-box">
                      <img src={result.image} alt={result.type} loading="lazy" />
                      <div className="result-hover-actions">
                        <button className="result-action-btn" onClick={(e) => handleSendToCanvas(e, result.image, result.prompt)} title="Send to Canvas">
                          <Send size={12} />
                        </button>
                        <button className="result-action-btn" onClick={(e) => handleExport(e, result.image, `result-${result.type}`)} title="Export">
                          <Download size={12} />
                        </button>
                      </div>
                    </div>
                    <div className="result-info">
                      <span className="result-type">{result.type}</span>
                      <span className="result-date">{new Date(result.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {exportTarget && (
        <ExportModal
          imageUrl={exportTarget.image}
          imageName={exportTarget.name}
          onClose={() => setExportTarget(null)}
        />
      )}
    </div>
  );
};
