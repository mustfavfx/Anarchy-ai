import type { HistoryEntry } from '../../../types/history';

export class AutoBackupEngine {
  private static BACKUP_KEY = 'anarchy_h3_crash_recovery_checkpoint';

  static saveCheckpoint(entry: HistoryEntry): void {
    try {
      localStorage.setItem(this.BACKUP_KEY, JSON.stringify({
        timestamp: Date.now(),
        entry
      }));
    } catch {}
  }

  static getCrashRecoveryCheckpoint(): HistoryEntry | null {
    try {
      const raw = localStorage.getItem(this.BACKUP_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed.entry || null;
    } catch {
      return null;
    }
  }

  static clearCheckpoint(): void {
    localStorage.removeItem(this.BACKUP_KEY);
  }
}
