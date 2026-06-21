import { useState, useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { SESSION_KEYS } from '../../../utils/storageKeys';

const TABS_STORAGE_KEY = 'anarchy_builder_tabs';
const ACTIVE_TAB_KEY   = 'anarchy_builder_active_tab';

export interface Tab {
  id: string;
  title: string;
  projectPath: string | null;
  isDirty: boolean;
  everEdited: boolean;
  initialWorkflow?: any;
  initialImage?: string;
}

export interface CloseConfirm {
  tabId: string;
  title: string;
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

export function useMultiBuilderTabs() {
  const location = useLocation();
  const [tabs, setTabs] = useState<Tab[]>(() => loadPersistedTabs().tabs);
  const [activeTabId, setActiveTabId] = useState<string | null>(() => loadPersistedTabs().activeTabId);
  const [closeConfirm, setCloseConfirm] = useState<CloseConfirm | null>(null);
  const [showAppCloseConfirm, setShowAppCloseConfirm] = useState(false);

  // Helper to remove legacy keys and orphaned tab autosaves
  const cleanupOrphanedAutosaves = useCallback((currentTabs: Tab[]) => {
    try {
      localStorage.removeItem('anarchy_workflows');
      localStorage.removeItem('anarchy_library');

      const activeTabIds = new Set(currentTabs.map(t => t.id));

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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, [cleanupOrphanedAutosaves]);

  // Persist tabs to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify(tabs));
    } catch (err) {
      console.warn('[MultiBuilderPage] Failed to save tabs to localStorage:', err);
      cleanupOrphanedAutosaves(tabs);
      try {
        localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify(tabs));
      } catch (retryErr) {
        console.error('[MultiBuilderPage] Still failing to save tabs after cleanup:', retryErr);
      }
    }
  }, [tabs, cleanupOrphanedAutosaves]);

  // Persist activeTabId
  useEffect(() => {
    if (activeTabId) {
      try {
        localStorage.setItem(ACTIVE_TAB_KEY, activeTabId);
      } catch (err) {
        console.warn('[MultiBuilderPage] Failed to save activeTabId to localStorage:', err);
      }
    }
  }, [activeTabId]);

  // Check for startup file (CLI args)
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

  // Listen for dynamic workflow loads via custom event
  useEffect(() => {
    const handleLoadWorkflow = (e: Event) => {
      const customEvent = e as CustomEvent<any>;
      const wf = customEvent.detail;
      if (!wf) return;
      
      console.log('[MultiBuilderTabs] Custom load-workflow event received:', wf);
      
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
    };

    window.addEventListener('anarchy:load-workflow', handleLoadWorkflow);
    return () => {
      window.removeEventListener('anarchy:load-workflow', handleLoadWorkflow);
    };
  }, []);

  // Process session storage loads
  useEffect(() => {
    // Only process session storage if we are on the builder page
    if (location.pathname !== '/builder' && tabs.length > 0) return;

    const projectPath = sessionStorage.getItem(SESSION_KEYS.OPEN_PROJECT_PATH);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- runs on startup and navigation to builder
  }, [location.pathname]);

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
    if (tab && tab.isDirty) {
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

  // Drag-to-reorder tabs
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

  // Listen to save completed events
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
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('exit_app');
    } catch {
      const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      const win = getCurrentWebviewWindow();
      await win.destroy();
    }
  };

  const handleAppSaveAndClose = async () => {
    setShowAppCloseConfirm(false);
    const dirtyTabs = tabs.filter(t => t.isDirty);
    if (dirtyTabs.length === 0) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('exit_app');
      } catch {
        const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
        const win = getCurrentWebviewWindow();
        await win.destroy();
      }
      return;
    }

    let currentIndex = 0;

    const saveNext = async () => {
      if (currentIndex >= dirtyTabs.length) {
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          await invoke('exit_app');
        } catch {
          const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
          const win = getCurrentWebviewWindow();
          await win.destroy();
        }
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

      window.dispatchEvent(new CustomEvent('anarchy:trigger-save-tab', {
        detail: { tabId: tab.id, closeAfterSave: true }
      }));
    };

    saveNext();
  };

  return {
    tabs,
    setTabs,
    activeTabId,
    setActiveTabId,
    closeConfirm,
    setCloseConfirm,
    showAppCloseConfirm,
    setShowAppCloseConfirm,
    createNewTab,
    requestCloseTab,
    doCloseTab,
    updateTabTitle,
    updateTabDirty,
    updateTabProjectPath,
    handleTabDragStart,
    handleTabDragOver,
    handleTabDrop,
    handleAppDontSaveAndClose,
    handleAppSaveAndClose,
  };
}
