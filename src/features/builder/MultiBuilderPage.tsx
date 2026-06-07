import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { Plus, X, FileText } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { BuilderContent } from './BuilderPage';
import { SESSION_KEYS } from '../../utils/storageKeys';
import './MultiBuilderPage.css';

const TABS_STORAGE_KEY = 'anarchy_builder_tabs';
const ACTIVE_TAB_KEY   = 'anarchy_builder_active_tab';

interface CloseConfirm {
  tabId: string;
  title: string;
}

interface Tab {
  id: string;
  title: string;
  projectPath: string | null;
  isDirty: boolean;
  everEdited: boolean;
  initialWorkflow?: any;
  initialImage?: string;
}

const generateTabId = () => `tab-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

const normalizePath = (p: string | null | undefined): string | null => {
  if (!p) return null;
  return p.replace(/\\/g, '/').toLowerCase();
};

function loadPersistedTabs(): { tabs: Tab[]; activeTabId: string | null } {
  try {
    const raw = localStorage.getItem(TABS_STORAGE_KEY);
    const active = localStorage.getItem(ACTIVE_TAB_KEY);
    if (raw) {
      const tabs: Tab[] = JSON.parse(raw);
      if (Array.isArray(tabs) && tabs.length > 0)
        return { tabs, activeTabId: active || tabs[0].id };
    }
  } catch { /* ignore */ }
  return { tabs: [], activeTabId: null };
}

export const MultiBuilderPage: React.FC = () => {
  const location = useLocation();
  const [tabs, setTabs] = useState<Tab[]>(() => loadPersistedTabs().tabs);
  const [activeTabId, setActiveTabId] = useState<string | null>(() => loadPersistedTabs().activeTabId);
  const [closeConfirm, setCloseConfirm] = useState<CloseConfirm | null>(null);

  // Helper to remove legacy keys and orphaned tab autosaves
  const cleanupOrphanedAutosaves = useCallback((currentTabs: Tab[]) => {
    try {
      // 1. Remove deprecated legacy keys that are no longer used but might be taking up space
      localStorage.removeItem('anarchy_workflows');
      localStorage.removeItem('anarchy_library');

      // 2. Build set of active tab IDs
      const activeTabIds = new Set(currentTabs.map(t => t.id));

      // 3. Find and remove all orphaned autosave keys in localStorage
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('anarchy_builder_silent_autosave_')) {
          const tabId = key.replace('anarchy_builder_silent_autosave_', '');
          if (tabId && !activeTabIds.has(tabId)) {
            keysToRemove.push(key);
          }
        }
      }

      if (keysToRemove.length > 0) {
        keysToRemove.forEach(k => localStorage.removeItem(k));
        console.log(`[StorageCleanup] Removed ${keysToRemove.length} orphaned autosave key(s).`);
      }
    } catch (err) {
      console.warn('[StorageCleanup] Failed to clean up orphaned autosaves:', err);
    }
  }, []);

  // Run startup cleanup once on mount
  useEffect(() => {
    cleanupOrphanedAutosaves(tabs);
  }, [cleanupOrphanedAutosaves]);

  // Persist tabs to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify(tabs));
    } catch (err) {
      console.warn('[MultiBuilderPage] Failed to save tabs to localStorage:', err);
      // Try to clean up orphaned autosaves to free up space
      cleanupOrphanedAutosaves(tabs);
      try {
        localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify(tabs));
      } catch (retryErr) {
        console.error('[MultiBuilderPage] Still failing to save tabs after cleanup:', retryErr);
      }
    }
  }, [tabs, cleanupOrphanedAutosaves]);

  useEffect(() => {
    if (activeTabId) {
      try {
        localStorage.setItem(ACTIVE_TAB_KEY, activeTabId);
      } catch (err) {
        console.warn('[MultiBuilderPage] Failed to save activeTabId to localStorage:', err);
      }
    }
  }, [activeTabId]);

  // Check for a file passed via command line arguments on startup
  useEffect(() => {
    const checkStartupFile = async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const path = await invoke<string | null>('get_startup_file');
        if (path) {
          console.log('[Startup] Found startup file path:', path);
          
          setTabs(prev => {
            const existing = prev.find(t => normalizePath(t.projectPath) === normalizePath(path));
            if (existing) {
              setTimeout(() => setActiveTabId(existing.id), 0);
              return prev;
            }
            const newTab: Tab = {
              id: generateTabId(),
              title: 'Loading...',
              projectPath: path,
              isDirty: false,
              everEdited: false,
            };
            setTimeout(() => setActiveTabId(newTab.id), 0);
            return [...prev, newTab];
          });
        }
      } catch (err) {
        console.error('Failed to get startup file:', err);
      }
    };

    checkStartupFile();
  }, []);

  // Handle opening a project from session or create initial tab
  useEffect(() => {
    if (location.pathname !== '/builder') return;

    const projectPath = sessionStorage.getItem(SESSION_KEYS.OPEN_PROJECT_PATH);
    const loadedWorkflow = sessionStorage.getItem(SESSION_KEYS.LOADED_WORKFLOW);
    const presetWorkflow = sessionStorage.getItem(SESSION_KEYS.PRESET_WORKFLOW);
    const presetImage = sessionStorage.getItem(SESSION_KEYS.PRESET_IMAGE);

    if (projectPath) {
      sessionStorage.removeItem(SESSION_KEYS.OPEN_PROJECT_PATH);
      
      setTabs(prev => {
        const existing = prev.find(t => normalizePath(t.projectPath) === normalizePath(projectPath));
        if (existing) {
          setTimeout(() => setActiveTabId(existing.id), 0);
          return prev;
        }
        const newTab: Tab = {
          id: generateTabId(),
          title: 'Loading...',
          projectPath: projectPath,
          isDirty: false,
          everEdited: false,
        };
        setTimeout(() => setActiveTabId(newTab.id), 0);
        return [...prev, newTab];
      });
    } else if (loadedWorkflow) {
      sessionStorage.removeItem(SESSION_KEYS.LOADED_WORKFLOW);
      try {
        const wf = JSON.parse(loadedWorkflow);
        const newTab: Tab = {
          id: generateTabId(),
          title: wf.name || 'Imported Project',
          projectPath: null,
          isDirty: false,
          everEdited: false,
          initialWorkflow: wf,
        };
        setTabs(prev => [...prev, newTab]);
        setTimeout(() => setActiveTabId(newTab.id), 0);
      } catch (err) {
        console.error('Failed to parse loaded workflow:', err);
      }
    } else if (presetWorkflow) {
      sessionStorage.removeItem(SESSION_KEYS.PRESET_WORKFLOW);
      const img = sessionStorage.getItem(SESSION_KEYS.PRESET_IMAGE);
      if (img) {
        sessionStorage.removeItem(SESSION_KEYS.PRESET_IMAGE);
      }
      try {
        const wf = JSON.parse(presetWorkflow);
        const newTab: Tab = {
          id: generateTabId(),
          title: wf.name || 'Preset Workflow',
          projectPath: null,
          isDirty: false,
          everEdited: false,
          initialWorkflow: wf,
          initialImage: img || undefined,
        };
        setTabs(prev => [...prev, newTab]);
        setTimeout(() => setActiveTabId(newTab.id), 0);
      } catch (err) {
        console.error('Failed to parse preset workflow:', err);
      }
    } else if (presetImage) {
      sessionStorage.removeItem(SESSION_KEYS.PRESET_IMAGE);
      const newTab: Tab = {
        id: generateTabId(),
        title: 'Preset Image',
        projectPath: null,
        isDirty: false,
        everEdited: false,
        initialImage: presetImage,
      };
      setTabs(prev => [...prev, newTab]);
      setTimeout(() => setActiveTabId(newTab.id), 0);
    } else if (tabs.length === 0) {
      const newTab: Tab = {
        id: generateTabId(),
        title: 'Untitled',
        projectPath: null,
        isDirty: false,
        everEdited: false,
      };
      setTabs([newTab]);
      setActiveTabId(newTab.id);
    }
  }, [tabs.length, location.pathname]);  

  const createNewTab = useCallback(() => {
    const newTab: Tab = {
      id: generateTabId(),
      title: 'Untitled',
      projectPath: null,
      isDirty: false,
      everEdited: false,
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, []);

  const doCloseTab = useCallback((tabId: string) => {
    setCloseConfirm(null);
    try {
      localStorage.removeItem(`anarchy_builder_silent_autosave_${tabId}`);
    } catch {}
    setTabs(prev => {
      const newTabs = prev.filter(t => t.id !== tabId);
      if (activeTabId === tabId && newTabs.length > 0) {
        const idx = prev.findIndex(t => t.id === tabId);
        const nextTab = prev[idx + 1] ?? prev[idx - 1];
        setActiveTabId(nextTab.id);
      } else if (newTabs.length === 0) {
        const emptyTab: Tab = {
          id: generateTabId(),
          title: 'Untitled',
          projectPath: null,
          isDirty: false,
          everEdited: false,
        };
        setActiveTabId(emptyTab.id);
        return [emptyTab];
      }
      return newTabs;
    });
  }, [activeTabId]);

  const requestCloseTab = useCallback((tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const tab = tabs.find(t => t.id === tabId);
    if (tab && tab.everEdited) {
      setCloseConfirm({ tabId, title: tab.title });
    } else {
      doCloseTab(tabId);
    }
  }, [tabs, doCloseTab]);

  const updateTabTitle = useCallback((tabId: string, title: string) => {
    setTabs(prev => prev.map(tab =>
      tab.id === tabId ? { ...tab, title } : tab
    ));
  }, []);

  const updateTabDirty = useCallback((tabId: string, dirty: boolean) => {
    setTabs(prev => prev.map(tab =>
      tab.id === tabId ? { ...tab, isDirty: dirty, everEdited: dirty ? true : tab.everEdited } : tab
    ));
  }, []);

  const updateTabProjectPath = useCallback((tabId: string, projectPath: string | null) => {
    setTabs(prev => prev.map(tab =>
      tab.id === tabId ? { ...tab, projectPath } : tab
    ));
  }, []);

  // ── Drag-to-reorder tabs ──
  const dragTabId = useRef<string | null>(null);

  const handleTabDragStart = useCallback((e: React.DragEvent, tabId: string) => {
    dragTabId.current = tabId;
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleTabDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleTabDrop = useCallback((e: React.DragEvent, targetTabId: string) => {
    e.preventDefault();
    const sourceId = dragTabId.current;
    if (!sourceId || sourceId === targetTabId) return;
    setTabs(prev => {
      const from = prev.findIndex(t => t.id === sourceId);
      const to   = prev.findIndex(t => t.id === targetTabId);
      if (from === -1 || to === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    dragTabId.current = null;
  }, []);

  const [showAppCloseConfirm, setShowAppCloseConfirm] = useState(false);

  // Listen to save completed events (to close tab or proceed in sequential app close)
  useEffect(() => {
    const handleSaveCompleted = (e: Event) => {
      const customEvent = e as CustomEvent<{ tabId: string; success: boolean }>;
      const { tabId, success } = customEvent.detail;
      if (success) {
        doCloseTab(tabId);
      }
    };

    window.addEventListener('anarchy:save-completed', handleSaveCompleted);
    return () => {
      window.removeEventListener('anarchy:save-completed', handleSaveCompleted);
    };
  }, [doCloseTab]);

  // Listen to app close request event
  useEffect(() => {
    const handleAppClose = () => {
      setShowAppCloseConfirm(true);
    };
    window.addEventListener('anarchy:trigger-app-close', handleAppClose);
    return () => window.removeEventListener('anarchy:trigger-app-close', handleAppClose);
  }, []);

  const handleAppDontSaveAndClose = async () => {
    setShowAppCloseConfirm(false);
    const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
    (window as any).__anarchy_force_close = true;
    await getCurrentWebviewWindow().close();
  };

  const handleAppSaveAndClose = async () => {
    setShowAppCloseConfirm(false);
    const dirtyTabs = tabs.filter(t => t.isDirty);
    if (dirtyTabs.length === 0) {
      const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      (window as any).__anarchy_force_close = true;
      await getCurrentWebviewWindow().close();
      return;
    }

    let currentIndex = 0;

    const saveNext = async () => {
      if (currentIndex >= dirtyTabs.length) {
        const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
        (window as any).__anarchy_force_close = true;
        await getCurrentWebviewWindow().close();
        return;
      }

      const tab = dirtyTabs[currentIndex];
      setActiveTabId(tab.id);

      const onSaveCompleted = async (e: Event) => {
        const customEvent = e as CustomEvent<{ tabId: string; success: boolean }>;
        if (customEvent.detail.tabId !== tab.id) return;

        window.removeEventListener('anarchy:save-completed', onSaveCompleted);

        if (customEvent.detail.success) {
          currentIndex++;
          setTimeout(saveNext, 100);
        } else {
          console.log('[AppClose] Save cancelled or failed for tab:', tab.id, '- aborted app exit.');
        }
      };

      window.addEventListener('anarchy:save-completed', onSaveCompleted);

      // Trigger save on this tab
      window.dispatchEvent(new CustomEvent('anarchy:trigger-save-tab', {
        detail: { tabId: tab.id, closeAfterSave: true }
      }));
    };

    saveNext();
  };

  return (
    <div className="multi-builder-container">
      {/* Tabs Bar */}
      <div className="builder-tabs-bar">
        <div className="builder-tabs-scroll">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              draggable
              className={`builder-tab ${activeTabId === tab.id ? 'active' : ''} ${tab.isDirty ? 'dirty' : ''}`}
              onClick={() => setActiveTabId(tab.id)}
              onDragStart={(e) => handleTabDragStart(e, tab.id)}
              onDragOver={handleTabDragOver}
              onDrop={(e) => handleTabDrop(e, tab.id)}
            >
              <FileText size={14} />
              <span className="tab-title">{tab.title}</span>
              {tab.isDirty && <span className="dirty-indicator">●</span>}
              <button
                type="button"
                className="tab-close-btn"
                onClick={(e) => { e.stopPropagation(); requestCloseTab(tab.id, e); }}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
        
        {/* New Tab Button */}
        <div className="new-tab-wrapper">
          <button
            className="new-tab-btn"
            title="New Tab"
            onClick={createNewTab}
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Tab Content — all tabs stay mounted to preserve canvas state */}
      <div className="builder-tabs-content">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className="tab-pane"
            style={{ display: activeTabId === tab.id ? 'flex' : 'none' }}
          >
            <ReactFlowProvider>
              <BuilderContent
                tabId={tab.id}
                projectPath={tab.projectPath}
                initialWorkflow={tab.initialWorkflow}
                initialImage={tab.initialImage}
                onTitleChange={(title) => updateTabTitle(tab.id, title)}
                onDirtyChange={(dirty) => updateTabDirty(tab.id, dirty)}
                onProjectPathChange={(path) => updateTabProjectPath(tab.id, path)}
                isActive={activeTabId === tab.id}
              />
            </ReactFlowProvider>
          </div>
        ))}
      </div>

      {/* Close Confirmation Dialog */}
      {closeConfirm && (
        <div className="tab-close-overlay" onClick={() => setCloseConfirm(null)}>
          <div className="tab-close-dialog" onClick={e => e.stopPropagation()}>
            <div className="tab-close-dialog-title">Save before closing?</div>
            <div className="tab-close-dialog-msg">
              <strong>{closeConfirm.title}</strong> has unsaved changes.
            </div>
            <div className="tab-close-dialog-actions">
              <button
                className="tab-close-dialog-btn secondary"
                onClick={() => doCloseTab(closeConfirm.tabId)}
              >
                Don't Save
              </button>
              <button
                className="tab-close-dialog-btn secondary"
                onClick={() => setCloseConfirm(null)}
              >
                Cancel
              </button>
              <button
                className="tab-close-dialog-btn primary"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('anarchy:trigger-save-tab', {
                    detail: { tabId: closeConfirm.tabId, closeAfterSave: true }
                  }));
                  setCloseConfirm(null);
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* App Close Confirmation Dialog */}
      {showAppCloseConfirm && (
        <div className="tab-close-overlay" onClick={() => setShowAppCloseConfirm(false)}>
          <div className="tab-close-dialog" onClick={e => e.stopPropagation()}>
            <div className="tab-close-dialog-title">Save changes before exiting?</div>
            <div className="tab-close-dialog-msg">
              You have unsaved changes in your tabs.
            </div>
            <div className="tab-close-dialog-actions">
              <button
                className="tab-close-dialog-btn secondary"
                onClick={handleAppDontSaveAndClose}
              >
                Don't Save
              </button>
              <button
                className="tab-close-dialog-btn secondary"
                onClick={() => setShowAppCloseConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="tab-close-dialog-btn primary"
                onClick={handleAppSaveAndClose}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
