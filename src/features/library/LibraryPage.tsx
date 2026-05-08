import React, { useState, useEffect, useCallback } from 'react';
import { Search, Download, Image as ImageIcon, Loader2, Eye, X } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { downloadImage } from '../../utils/imageExport';
import { getHistory } from '../../services/history/HistoryService';
import './LibraryPage.css';

interface LibraryAsset {
  id: string;
  name: string;
  project: string;
  type: 'source' | 'result' | 'reference';
  image: string;
  prompt?: string;
  createdAt: number;
}

type FilterType = 'all' | 'source' | 'result' | 'reference';

export const LibraryPage: React.FC = () => {
  const [assets, setAssets] = useState<LibraryAsset[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<LibraryAsset | null>(null);

  const loadAssets = useCallback(async () => {
    setLoading(true);
    try {
      const appData: string = await invoke('get_app_data_dir');
      const dir = `${appData}\\projects`;
      await invoke('ensure_dir', { path: dir });
      const files: string[] = await invoke('list_dir', { path: dir, extension: 'ana' });

      const allAssets: LibraryAsset[] = [];

      // Load from project files
      for (const fp of files) {
        try {
          const contents: string = await invoke('load_file', { path: fp });
          const wf = JSON.parse(contents);
          const projectName = wf.name || fp.replace(/\\\\/g, '/').split('/').pop()?.replace('.ana', '') || 'Unknown';

          for (const node of wf.nodes || []) {
            const d = node.data;
            if (!d) continue;

            const img = d.image || d.outputData?.image;
            if (!img || typeof img !== 'string') continue;

            const nodeType: 'source' | 'result' | 'reference' =
              d.type === 'source' ? 'source' :
              d.type === 'result' ? 'result' : 'reference';

            allAssets.push({
              id: `${fp}-${node.id}`,
              name: d.label || d.prompt?.slice(0, 30) || `${nodeType} ${node.id}`,
              project: projectName,
              type: nodeType,
              image: img,
              prompt: d.prompt,
              createdAt: d.createdAt || wf.createdAt || 0,
            });
          }
        } catch {
          // skip corrupt files
        }
      }

      // Load from History
      const historyEntries = getHistory();
      for (const entry of historyEntries) {
        // Add output image as asset
        if (entry.outputImage) {
          allAssets.push({
            id: `hist-${entry.id}-out`,
            name: entry.label || entry.prompt?.slice(0, 30) || 'History Output',
            project: entry.project || 'History',
            type: 'result',
            image: entry.outputImage,
            prompt: entry.prompt,
            createdAt: entry.timestamp,
          });
        }
        // Add input image as asset (if different from output)
        if (entry.inputImage && entry.inputImage !== entry.outputImage) {
          allAssets.push({
            id: `hist-${entry.id}-in`,
            name: `${entry.label || 'Input'} (Source)`,
            project: entry.project || 'History',
            type: 'source',
            image: entry.inputImage,
            prompt: entry.prompt,
            createdAt: entry.timestamp,
          });
        }
      }

      allAssets.sort((a, b) => b.createdAt - a.createdAt);
      setAssets(allAssets);
    } catch (err) {
      console.error('[Library] Load failed:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadAssets(); }, [loadAssets]);

  // Reload when history changes (e.g. new generation completed)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'anarchy_history') loadAssets();
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [loadAssets]);

  const filtered = assets.filter(a => {
    if (filter !== 'all' && a.type !== filter) return false;
    if (search && !a.name.toLowerCase().includes(search.toLowerCase()) && !a.project.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleDownload = (e: React.MouseEvent, asset: LibraryAsset) => {
    e.stopPropagation();
    downloadImage(asset.image, `${asset.name}.png`);
  };

  const counts = {
    all: assets.length,
    source: assets.filter(a => a.type === 'source').length,
    result: assets.filter(a => a.type === 'result').length,
    reference: assets.filter(a => a.type === 'reference').length,
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
          <div className="filter-chips">
            {(['all', 'source', 'result', 'reference'] as FilterType[]).map(f => (
              <button
                key={f}
                className={`filter-chip ${filter === f ? 'active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
                <span className="chip-count">{counts[f]}</span>
              </button>
            ))}
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
          <h3>{search || filter !== 'all' ? 'No matching assets' : 'Library is empty'}</h3>
          <p>{search || filter !== 'all' ? 'Try different search or filters' : 'Generate images in the Builder to see them here'}</p>
        </div>
      ) : (
        <div className="assets-grid">
          {filtered.map(asset => (
            <div
              key={asset.id}
              className="asset-card"
              onClick={() => setPreview(asset)}
            >
              <div className="asset-image-box">
                <img src={asset.image} alt={asset.name} loading="lazy" />
                <div className={`asset-type-tag ${asset.type}`}>
                  {asset.type}
                </div>
                <div className="asset-hover-actions">
                  <button className="asset-action-btn" onClick={(e) => { e.stopPropagation(); setPreview(asset); }} title="Preview">
                    <Eye size={14} />
                  </button>
                  <button className="asset-action-btn" onClick={(e) => handleDownload(e, asset)} title="Download">
                    <Download size={14} />
                  </button>
                </div>
              </div>
              <div className="asset-details">
                <h4 className="asset-name">{asset.name}</h4>
                <p className="asset-project">{asset.project}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      {preview && (
        <div className="library-preview-overlay" onClick={() => setPreview(null)}>
          <div className="library-preview-modal" onClick={e => e.stopPropagation()}>
            <button className="preview-close" onClick={() => setPreview(null)}>
              <X size={18} />
            </button>
            <div className="preview-image-wrap">
              <img src={preview.image} alt={preview.name} />
            </div>
            <div className="preview-info">
              <h3>{preview.name}</h3>
              <p className="preview-project">{preview.project}</p>
              {preview.prompt && <p className="preview-prompt">{preview.prompt}</p>}
              <div className="preview-actions">
                <button className="preview-download-btn" onClick={(e) => handleDownload(e, preview)}>
                  <Download size={14} />
                  <span>Download</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
