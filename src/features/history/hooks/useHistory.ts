import { useEffect } from 'react';
import { useHistoryStore } from '../stores/historyStore';
import { migrateLegacyHistory } from '../services/HistoryService';
import { logger } from '../../../utils/logger';

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

  return store;
}
