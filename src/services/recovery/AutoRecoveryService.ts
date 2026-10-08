/**
 * Auto-Recovery Service
 * Periodically saves lightweight .ana.bak snapshots for dirty tabs
 * and offers instant crash/power-outage recovery on app startup.
 */

import { invoke } from '@tauri-apps/api/core';
import { logger } from '../../utils/logger';
import { APP_INFO } from '../../config/appInfo';

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

    // 1. Save to LocalStorage registry (deduplicate against same projectPath or title)
    try {
      const existing = this.getAllSnapshotsMap();
      const normPath = projectPath?.trim().toLowerCase().replace(/\\/g, '/');
      const normTitle = title?.trim().toLowerCase();

      // Prune stale duplicates under older tab IDs
      for (const [k, s] of Object.entries(existing)) {
        if (k !== tabId) {
          const sPath = s.projectPath?.trim().toLowerCase().replace(/\\/g, '/');
          const sTitle = s.title?.trim().toLowerCase();
          if ((normPath && sPath && normPath === sPath) || (normTitle && sTitle && normTitle === sTitle)) {
            delete existing[k];
          }
        }
      }

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
            version: APP_INFO.version,
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
   * Clear snapshot for a tab after clean save, clean close, or discard.
   * Matches by tabId, projectPath, and/or title to ensure no lingering snapshots.
   */
  static async clearRecoverySnapshot(
    tabId?: string | null,
    projectPath?: string | null,
    title?: string | null
  ): Promise<void> {
    try {
      const existing = this.getAllSnapshotsMap();
      let changed = false;
      const pathsToDeleteOnDisk = new Set<string>();

      if (projectPath) {
        pathsToDeleteOnDisk.add(`${projectPath}.bak`);
      }

      // 1. Clear by tabId
      if (tabId && existing[tabId]) {
        if (existing[tabId].bakFilePath) {
          pathsToDeleteOnDisk.add(existing[tabId].bakFilePath!);
        }
        delete existing[tabId];
        changed = true;
      }

      // 2. Clear by projectPath or title
      const normPath = projectPath?.trim().toLowerCase().replace(/\\/g, '/');
      const normTitle = title?.trim().toLowerCase();

      for (const [key, snap] of Object.entries(existing)) {
        const sPath = snap.projectPath?.trim().toLowerCase().replace(/\\/g, '/');
        const sTitle = snap.title?.trim().toLowerCase();

        const matchPath = normPath && sPath && (normPath === sPath || normPath.endsWith(sPath) || sPath.endsWith(normPath));
        const matchTitle = normTitle && sTitle && (normTitle === sTitle);

        if (matchPath || matchTitle) {
          if (snap.bakFilePath) {
            pathsToDeleteOnDisk.add(snap.bakFilePath);
          }
          if (snap.projectPath) {
            pathsToDeleteOnDisk.add(`${snap.projectPath}.bak`);
          }
          delete existing[key];
          changed = true;
        }
      }

      if (changed) {
        localStorage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify(existing));
      }

      // 3. Delete physical .ana.bak files from disk
      for (const bakPath of pathsToDeleteOnDisk) {
        try {
          await invoke('delete_file', { path: bakPath });
        } catch {
          // File might not exist or running in browser mode
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
      if (item.bakFilePath) {
        try {
          await invoke('delete_file', { path: item.bakFilePath });
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
