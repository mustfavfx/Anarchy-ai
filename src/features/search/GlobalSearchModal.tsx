import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, Folder, Image as ImageIcon, History, Sparkles, 
  Terminal, X, ChevronRight, Plus, Settings, FolderOpen, Layers
} from 'lucide-react';
import { listProjects, type ProjectMeta } from '../../services/projects/ProjectService';
import { loadEntries, type HistoryEntry } from '../../services/history/HistoryService';
import { PRESET_PROMPTS, VIDEO_PRESET_PROMPTS } from '../builder/presetPrompts';
import { SESSION_KEYS } from '../../utils/storageKeys';
import { useTranslation } from '../../services/i18n';
import { useFocusTrap } from '../../shared/hooks/useFocusTrap';
import './GlobalSearchModal.css';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchItem {
  id: string;
  category: 'projects' | 'assets' | 'history' | 'presets' | 'commands';
  title: string;
  subtitle?: string;
  thumbnailUrl?: string;
  action: () => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [historyItems, setHistoryItems] = useState<HistoryEntry[]>([]);

  const modalRef = useFocusTrap<HTMLDivElement>({
    isActive: isOpen,
    onEscape: onClose,
    initialFocusRef: inputRef,
  });

  // Load projects & history when opened
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setSelectedIndex(0);
      return;
    }

    let isMounted = true;
    listProjects()
      .then(list => { if (isMounted) setProjects(list); })
      .catch(() => {});

    try {
      const entries = loadEntries();
      if (isMounted) setHistoryItems(entries.slice(0, 50));
    } catch {}

    return () => { isMounted = false; };
  }, [isOpen]);

  // Build items list
  const results = useMemo<SearchItem[]>(() => {
    const q = query.trim().toLowerCase();
    const items: SearchItem[] = [];

    // Commands (always available or filtered)
    const commands: SearchItem[] = [
      {
        id: 'cmd-new-canvas',
        category: 'commands',
        title: 'New Canvas',
        subtitle: 'Open a blank builder workspace',
        action: () => { navigate('/builder'); onClose(); }
      },
      {
        id: 'cmd-open-projects',
        category: 'commands',
        title: 'Go to Projects',
        subtitle: 'View and manage all project workflow files',
        action: () => { navigate('/projects'); onClose(); }
      },
      {
        id: 'cmd-open-library',
        category: 'commands',
        title: 'Go to Library',
        subtitle: 'Browse generated media & image assets',
        action: () => { navigate('/library'); onClose(); }
      },
      {
        id: 'cmd-open-history',
        category: 'commands',
        title: 'Go to History',
        subtitle: 'Search and inspect previous generation runs',
        action: () => { navigate('/history'); onClose(); }
      },
      {
        id: 'cmd-open-settings',
        category: 'commands',
        title: 'Go to Settings',
        subtitle: 'Configure AI watermark, storage, and language',
        action: () => { navigate('/settings'); onClose(); }
      }
    ];

    commands.forEach(c => {
      if (!q || c.title.toLowerCase().includes(q) || c.subtitle?.toLowerCase().includes(q)) {
        items.push(c);
      }
    });

    // Projects
    projects.forEach(p => {
      if (!q || p.name.toLowerCase().includes(q)) {
        items.push({
          id: `proj-${p.filePath}`,
          category: 'projects',
          title: p.name,
          subtitle: `Updated: ${new Date(p.updatedAt).toLocaleDateString()}`,
          thumbnailUrl: p.thumbnailUrl,
          action: () => {
            sessionStorage.setItem(SESSION_KEYS.OPEN_PROJECT_PATH, p.filePath);
            navigate('/builder');
            onClose();
          }
        });
      }
    });

    // Library & Assets / History
    historyItems.forEach(h => {
      const prompt = h.prompt || '';
      if (!q || prompt.toLowerCase().includes(q) || h.model?.toLowerCase().includes(q)) {
        items.push({
          id: `hist-${h.id}`,
          category: 'assets',
          title: prompt ? (prompt.length > 50 ? `${prompt.slice(0, 50)}...` : prompt) : 'Generated Image',
          subtitle: `${h.model || 'AI Model'} • ${new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
          thumbnailUrl: h.outputImage || h.inputImage,
          action: () => {
            sessionStorage.setItem(SESSION_KEYS.PRESET_PROMPT, prompt);
            navigate('/builder');
            onClose();
          }
        });
      }
    });

    // Presets
    const allPresets = [
      ...PRESET_PROMPTS.flatMap(g => g.prompts),
      ...VIDEO_PRESET_PROMPTS.flatMap(g => g.prompts)
    ];

    allPresets.forEach((p, idx) => {
      if (q && (p.label.toLowerCase().includes(q) || p.text.toLowerCase().includes(q))) {
        items.push({
          id: `preset-${idx}-${p.label}`,
          category: 'presets',
          title: p.label,
          subtitle: p.text.length > 60 ? `${p.text.slice(0, 60)}...` : p.text,
          action: () => {
            sessionStorage.setItem(SESSION_KEYS.PRESET_PROMPT, p.text);
            navigate('/builder');
            onClose();
          }
        });
      }
    });

    return items.slice(0, 40);
  }, [query, projects, historyItems, navigate, onClose]);

  // Keep selected index in range
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1 < results.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 >= 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        results[selectedIndex].action();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="global-search-overlay" onClick={onClose} aria-hidden="false">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Global Search and Command Palette"
        className="global-search-container"
        onClick={e => e.stopPropagation()}
        tabIndex={-1}
      >
        {/* Search Input Bar */}
        <div className="global-search-input-wrap">
          <Search size={18} className="search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="global-search-input"
            placeholder={t('search.placeholder', 'Search projects, assets, presets, commands (Ctrl+K)...')}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-autocomplete="list"
          />
          {query && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setQuery('')}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
          <span className="search-badge">ESC to close</span>
        </div>

        {/* Results List */}
        <div className="global-search-results" role="listbox">
          {results.length === 0 ? (
            <div className="search-empty-state">
              <Sparkles size={24} className="empty-icon" />
              <p>{t('search.noResults', 'No matching results found')}</p>
            </div>
          ) : (
            results.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  role="option"
                  aria-selected={isSelected}
                  className={`search-result-item ${isSelected ? 'selected' : ''}`}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div className="item-icon-wrap">
                    {item.category === 'projects' && <Folder size={16} className="text-amber" />}
                    {item.category === 'assets' && <ImageIcon size={16} className="text-emerald" />}
                    {item.category === 'presets' && <Sparkles size={16} className="text-purple" />}
                    {item.category === 'commands' && <Terminal size={16} className="text-rose" />}
                  </div>

                  {item.thumbnailUrl ? (
                    <img src={item.thumbnailUrl} alt="" className="item-thumb" />
                  ) : null}

                  <div className="item-content">
                    <div className="item-title">{item.title}</div>
                    {item.subtitle && <div className="item-sub">{item.subtitle}</div>}
                  </div>

                  <span className="item-category-badge">{item.category}</span>
                  <ChevronRight size={14} className="item-arrow" />
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="global-search-footer">
          <div className="shortcut-hint">
            <kbd>↑</kbd> <kbd>↓</kbd> to navigate
          </div>
          <div className="shortcut-hint">
            <kbd>Enter</kbd> to select
          </div>
          <div className="shortcut-hint">
            <kbd>Esc</kbd> to close
          </div>
        </div>
      </div>
    </div>
  );
};
