import { IndexedDBAdapter } from '../storage/IndexedDBAdapter';
import { ValidationService } from './ValidationService';
import type { HistoryEntry } from '../../../types/history';

export class MigrationService {
  static async migrateLegacyStorage(): Promise<number> {
    let count = 0;
    try {
      const legacyKeys = ['anarchy_history_v1', 'history_entries_v2', 'anarchy_history_store'];
      for (const key of legacyKeys) {
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            const items: any[] = Array.isArray(parsed) ? parsed : (parsed.entries || []);
            for (const item of items) {
              if (ValidationService.validateEntry(item)) {
                await IndexedDBAdapter.saveEntry(item);
                count++;
              } else {
                const repaired = ValidationService.repairEntry(item);
                await IndexedDBAdapter.saveEntry(repaired);
                count++;
              }
            }
          } catch {}
        }
      }
    } catch (err) {
      console.warn('[MigrationService] Legacy migration failed:', err);
    }
    return count;
  }
}
