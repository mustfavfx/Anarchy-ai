import type { HistoryEntry } from '../../../types/history';

export class HistoryBackupService {
  static exportBackup(entries: HistoryEntry[]): string {
    const payload = {
      version: '3.0',
      exportedAt: Date.now(),
      count: entries.length,
      entries,
    };
    return JSON.stringify(payload, null, 2);
  }

  static parseBackup(jsonString: string): HistoryEntry[] {
    try {
      const parsed = JSON.parse(jsonString);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && Array.isArray(parsed.entries)) return parsed.entries;
      return [];
    } catch {
      return [];
    }
  }
}
