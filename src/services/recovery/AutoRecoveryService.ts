/**
 * Auto-Recovery Service
 * Periodically saves lightweight .ana.bak snapshots for dirty tabs
 * and offers instant crash/power-outage recovery on app startup.
 */

import { invoke } from '@tauri-apps/api/core';
import { logger } from '../../utils/logger';

export interface RecoverySnapshot {
  tabId: string;
  title: string;
  projectPath: string | null;
  nodes: any[];
  edges: any[];
  timestamp: number;
  bakFilePath?: string | null;
}

const RECOVERY_STORAGE_KEY = 'anarchy_recovery_snapshots';

export class AutoRecoveryService {
  /**
   * Save a lightweight recovery snapshot (.ana.bak) for a tab
   */
  static async saveRecoverySnapshot(
    tabId: string,
    title: string,
    nodes: any[],
    edges: any[],
    projectPath: string | null = null
  ): Promise<void> {
    if (!nodes || nodes.length === 0) return;

    // Sanitize nodes for lightweight snapshot (keep idb:// references, strip heavy raw base64 if huge)
    const lightweightNodes = nodes.map(n => {
      const data = { ...(n.data || {}) };
      // If image is a raw base64 over 500KB, avoid blowing up localStorage
      if (typeof data.image === 'string' && data.image.startsWith('data:') && data.image.length > 500000) {
        data.image = undefined; // IDB stores the actual binary
      }
      return {
        ...n,
        data,
      };
    });

    const snapshot: RecoverySnapshot = {
      tabId,
      title: title || 'Untitled Session',
      projectPath,
      nodes: lightweightNodes,
      edges: edges || [],
      timestamp: Date.now(),
    };

    // 1. Save to LocalStorage registry
    try {
      const existing = this.getAllSnapshotsMap();
      existing[tabId] = snapshot;
      localStorage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify(existing));
    } catch (err) {
      logger.warn('[AutoRecovery] LocalStorage save error:', err);
    }

    // 2. If project has a path on disk, save .ana.bak file
    if (projectPath) {
      try {
        const bakPath = `${projectPath}.bak`;
        const content = JSON.stringify(
          {
            ...snapshot,
            version: '0.3.90',
            recoveryNotice: 'Anarchy AI Auto-Recovery Snapshot',
          },
          null,
          2
        );
        await invoke('save_file', { path: bakPath, contents: content });
        snapshot.bakFilePath = bakPath;
      } catch (err) {
        logger.warn('[AutoRecovery] Failed to write .ana.bak file to disk:', err);
      }
    }
  }

  /**
   * Check for any pending recovery snapshots left over from previous unclean sessions
   */
  static getPendingRecoverySnapshots(): RecoverySnapshot[] {
    try {
      const snapshotsMap = this.getAllSnapshotsMap();
      const list = Object.values(snapshotsMap);
      const now = Date.now();
      // Only keep snapshots less than 7 days old with actual nodes
      return list.filter(
        s => s.nodes && s.nodes.length > 0 && now - s.timestamp < 7 * 24 * 3600 * 1000
      );
    } catch (err) {
      logger.warn('[AutoRecovery] Failed to read pending snapshots:', err);
      return [];
    }
  }

  /**
   * Clear snapshot for a tab after clean save or clean close
   */
  static async clearRecoverySnapshot(tabId: string, projectPath?: string | null): Promise<void> {
    try {
      const existing = this.getAllSnapshotsMap();
      if (existing[tabId]) {
        delete existing[tabId];
        localStorage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify(existing));
      }

      if (projectPath) {
        const bakPath = `${projectPath}.bak`;
        try {
          await invoke('delete_file', { path: bakPath });
        } catch {
          // File might not exist, harmless
        }
      }
    } catch (err) {
      logger.warn('[AutoRecovery] Failed to clear snapshot:', err);
    }
  }

  /**
   * Discard all pending snapshots
   */
  static async discardAllSnapshots(): Promise<void> {
    const list = this.getPendingRecoverySnapshots();
    for (const item of list) {
      if (item.projectPath) {
        try {
          await invoke('delete_file', { path: `${item.projectPath}.bak` });
        } catch {}
      }
    }
    localStorage.removeItem(RECOVERY_STORAGE_KEY);
  }

  private static getAllSnapshotsMap(): Record<string, RecoverySnapshot> {
    try {
      const raw = localStorage.getItem(RECOVERY_STORAGE_KEY);
      if (!raw) return {};
      return JSON.parse(raw) || {};
    } catch {
      return {};
    }
  }
}
