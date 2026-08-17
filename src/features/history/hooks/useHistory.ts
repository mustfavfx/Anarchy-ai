import { useEffect, useCallback } from 'react';
import { useHistoryStore } from '@/stores/historyStore';
import { migrateLegacyHistory } from '@/services/history/HistoryService';
import { logger } from '@/utils/logger';
import { historyEngine } from '@/services/history/engine';

export function useHistory() {
  const store = useHistoryStore();
  const { refreshHistory, refreshCollections } = store;

  // 1. Initial migrations, load database and collections
  useEffect(() => {
    let active = true;
    
    const init = async () => {
      try {
        // Run migration first
        await migrateLegacyHistory();
        if (!active) return;

        // Run self-healing check in background
        try {
          const { selfHealHistory } = await import('@/services/history/HistorySelfHealing');
          await selfHealHistory();
        } catch (healErr) {
          logger.error('[useHistory] Self-healing failed:', healErr);
        }
        if (!active) return;
        
        // Refresh entries and collections
        refreshHistory();
        refreshCollections();

        // Rebuild SearchIndex Trie with existing entries
        try {
          await historyEngine.rebuildSearchIndex();
          logger.log(`[useHistory] SearchIndex rebuilt successfully.`);
        } catch (seedErr) {
          logger.warn('[useHistory] SearchIndex rebuild failed (non-critical):', seedErr);
        }
      } catch (err) {
        logger.error('[useHistory] Initialization failed:', err);
      }
    };
    
    init();
    return () => { active = false; };
  }, [refreshHistory, refreshCollections]);

  // 2. Subscribe to CommandLog appends for UI synchronization
  useEffect(() => {
    const unsub = historyEngine.commandLog.onAppend(() => refreshHistory());
    return () => unsub();
  }, [refreshHistory]);

  // 3. Subscribe to legacy DOM storage events as fallback
  useEffect(() => {
    const onHistoryUpdated = () => refreshHistory();
    const onCollectionsUpdated = () => refreshCollections();
    
    globalThis.addEventListener('storage', onHistoryUpdated);
    globalThis.addEventListener('anarchy:history:updated', onHistoryUpdated);
    globalThis.addEventListener('focus', onHistoryUpdated);
    globalThis.addEventListener('anarchy:collections:updated', onCollectionsUpdated);

    return () => {
      globalThis.removeEventListener('storage', onHistoryUpdated);
      globalThis.removeEventListener('anarchy:history:updated', onHistoryUpdated);
      globalThis.removeEventListener('focus', onHistoryUpdated);
      globalThis.removeEventListener('anarchy:collections:updated', onCollectionsUpdated);
    };
  }, [refreshHistory, refreshCollections]);

  // 4. Ctrl+Z / Ctrl+Y — Undo/Redo via CommandEngine
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const isTyping = ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName);
    if (isTyping) return;

    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
      e.preventDefault();
      historyEngine.undo.undo('default-canvas').catch?.(() => {});
    } else if (
      (e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))
    ) {
      e.preventDefault();
      historyEngine.undo.redo('default-canvas').catch?.(() => {});
    }
  }, []);


  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // 3. Trigger background semantic search indexing when entries change (only if AI Semantic Search is active)
  useEffect(() => {
    if (store.useSemanticSearch && store.entries.length > 0) {
      import('@/services/history/SemanticSearchService')
        .then(m => m.indexMissingEntries(store.entries))
        .catch(err => logger.error('[useHistory] Failed background indexing:', err));
    }
  }, [store.entries, store.useSemanticSearch]);

  // 4. Subscribe to semantic search model loading status and progress events
  useEffect(() => {
    const setSemanticStatus = store.setSemanticStatus;
    
    const handleStatus = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.status === 'loading') {
        setSemanticStatus(true, null, false);
      } else if (detail.status === 'ready') {
        setSemanticStatus(false, null, false);
      } else if (detail.status === 'error') {
        setSemanticStatus(false, null, true);
      }
    };
    
    const handleProgress = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setSemanticStatus(true, detail, false);
    };

    window.addEventListener('anarchy:semantic:status', handleStatus);
    window.addEventListener('anarchy:semantic:progress', handleProgress);

    return () => {
      window.removeEventListener('anarchy:semantic:status', handleStatus);
      window.removeEventListener('anarchy:semantic:progress', handleProgress);
    };
  }, [store.setSemanticStatus]);

  return store;
}
