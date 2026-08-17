import { useCallback, useState } from 'react';
import type { HistoryEntry } from '@/types/history';
import { historyEngine } from '@/services/history/engine';

export interface NamedSnapshot {
  id: string;
  name: string;
  entryId: string;
  createdAt: number;
}

const STORAGE_KEY = 'anarchy_named_snapshots';

function loadSnapshots(): NamedSnapshot[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSnapshots(snapshots: NamedSnapshot[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshots));
}

/**
 * useNamedSnapshot — Named Checkpoint system similar to Figma's "Saved Versions".
 */
export function useNamedSnapshot() {
  const [snapshots, setSnapshots] = useState<NamedSnapshot[]>(loadSnapshots);

  const createSnapshot = useCallback((name: string, entry: HistoryEntry): NamedSnapshot => {
    const snapshot: NamedSnapshot = {
      id: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim() || `Snapshot ${new Date().toLocaleTimeString()}`,
      entryId: entry.id,
      createdAt: Date.now(),
    };
    const updated = [snapshot, ...loadSnapshots()];
    saveSnapshots(updated);
    setSnapshots(updated);
    return snapshot;
  }, []);

  const deleteSnapshot = useCallback((id: string) => {
    const updated = loadSnapshots().filter(s => s.id !== id);
    saveSnapshots(updated);
    setSnapshots(updated);
  }, []);

  const restoreSnapshot = useCallback(async (
    snapshot: NamedSnapshot,
    navigate: (path: string) => void
  ): Promise<boolean> => {
    const entry = await historyEngine.getById(snapshot.entryId);
    if (!entry) return false;
    const { CanvasSessionManager } = await import('@/services/history/engine');
    CanvasSessionManager.setPending('default-canvas', {
      kind: 'image',
      image: entry.url || entry.thumbnailUrl || '',
      source: `history:${entry.id}`,
      label: entry.prompt || 'Snapshot',
      prompt: entry.prompt || '',
      model: entry.model || '',
    });
    navigate('/builder');
    return true;
  }, []);

  const refresh = useCallback(() => {
    setSnapshots(loadSnapshots());
  }, []);

  return { snapshots, createSnapshot, deleteSnapshot, restoreSnapshot, refresh };
}
