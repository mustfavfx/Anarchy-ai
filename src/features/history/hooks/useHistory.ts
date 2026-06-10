import { useEffect } from 'react';
import { useHistoryStore } from '../stores/historyStore';
import { migrateLegacyHistory } from '../services/HistoryService';
import { indexMissingEntries } from '../services/SemanticSearchService';
import { logger } from '../../../utils/logger';

export function useHistory() {
  const store = useHistoryStore();
  const { entries, refreshHistory, refreshCollections, setSemanticStatus } = store;

  // 1. Initial migrations, load database and collections
  useEffect(() => {
    let active = true;
    
    const init = async () => {
      try {
        // Run migration first
        await migrateLegacyHistory();
        if (!active) return;
        
        // Refresh entries and collections
        refreshHistory();
        refreshCollections();
      } catch (err) {
        logger.error('[useHistory] Initialization failed:', err);
      }
    };
    
    init();
    return () => { active = false; };
  }, [refreshHistory, refreshCollections]);

  // 2. Subscribe to custom global storage and state update events
  useEffect(() => {
    const onHistoryUpdated = () => refreshHistory();
    const onCollectionsUpdated = () => refreshCollections();
    
    const onSemanticStatus = (e: Event) => {
      const { status } = (e as CustomEvent).detail;
      setSemanticStatus(
        status === 'loading',
        null,
        status === 'error'
      );
    };

    const onSemanticProgress = (e: Event) => {
      const progress = (e as CustomEvent).detail;
      setSemanticStatus(true, progress, false);
    };

    globalThis.addEventListener('storage', onHistoryUpdated);
    globalThis.addEventListener('anarchy:history:updated', onHistoryUpdated);
    globalThis.addEventListener('focus', onHistoryUpdated);
    globalThis.addEventListener('anarchy:collections:updated', onCollectionsUpdated);
    window.addEventListener('anarchy:semantic:status', onSemanticStatus);
    window.addEventListener('anarchy:semantic:progress', onSemanticProgress);

    return () => {
      globalThis.removeEventListener('storage', onHistoryUpdated);
      globalThis.removeEventListener('anarchy:history:updated', onHistoryUpdated);
      globalThis.removeEventListener('focus', onHistoryUpdated);
      globalThis.removeEventListener('anarchy:collections:updated', onCollectionsUpdated);
      window.removeEventListener('anarchy:semantic:status', onSemanticStatus);
      window.removeEventListener('anarchy:semantic:progress', onSemanticProgress);
    };
  }, [refreshHistory, refreshCollections, setSemanticStatus]);

  // 3. Background indexing worker for prompts vector embeddings
  useEffect(() => {
    if (entries.length > 0) {
      // Run indexing asynchronously after entries are loaded
      const timer = setTimeout(() => {
        indexMissingEntries(entries).catch(() => {});
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [entries]);

  return store;
}
