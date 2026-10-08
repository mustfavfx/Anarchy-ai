import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AutoRecoveryService } from './AutoRecoveryService';
import { invoke } from '@tauri-apps/api/core';

vi.mocked(invoke);

describe('AutoRecoveryService', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('saves recovery snapshot to localStorage and invokes file save if path exists', async () => {
    const nodes = [{ id: 'node-1', data: { label: 'Source', image: 'test.png' } }];
    const edges = [{ id: 'edge-1' }];

    await AutoRecoveryService.saveRecoverySnapshot(
      'tab-1',
      'Sarii Project',
      nodes,
      edges,
      'C:\\Projects\\Sarii.ana'
    );

    const pending = AutoRecoveryService.getPendingRecoverySnapshots();
    expect(pending.length).toBe(1);
    expect(pending[0].tabId).toBe('tab-1');
    expect(pending[0].title).toBe('Sarii Project');
    expect(pending[0].projectPath).toBe('C:\\Projects\\Sarii.ana');
    expect(invoke).toHaveBeenCalledWith('save_file', expect.objectContaining({
      path: 'C:\\Projects\\Sarii.ana.bak'
    }));
  });

  it('deduplicates stale snapshots with the same path or title under new tab IDs', async () => {
    const nodes = [{ id: 'node-1', data: { label: 'Source' } }];

    // Session 1 crashes under old tab ID
    await AutoRecoveryService.saveRecoverySnapshot(
      'tab-old',
      'Sarii',
      nodes,
      [],
      'C:\\Projects\\Sarii.ana'
    );

    expect(AutoRecoveryService.getPendingRecoverySnapshots().length).toBe(1);

    // Session 2 reopens under new tab ID and updates snapshot
    await AutoRecoveryService.saveRecoverySnapshot(
      'tab-new',
      'Sarii',
      nodes,
      [],
      'C:\\Projects\\Sarii.ana'
    );

    const list = AutoRecoveryService.getPendingRecoverySnapshots();
    expect(list.length).toBe(1);
    expect(list[0].tabId).toBe('tab-new');
  });

  it('clears recovery snapshot by tabId, path, or title', async () => {
    const nodes = [{ id: 'node-1', data: { label: 'Source' } }];

    await AutoRecoveryService.saveRecoverySnapshot(
      'tab-123',
      'Sarii',
      nodes,
      [],
      'C:\\Projects\\Sarii.ana'
    );

    expect(AutoRecoveryService.getPendingRecoverySnapshots().length).toBe(1);

    // Cleared on save with matching title and path, even if tabId is different
    await AutoRecoveryService.clearRecoverySnapshot('tab-different', 'C:\\Projects\\Sarii.ana', 'Sarii');

    expect(AutoRecoveryService.getPendingRecoverySnapshots().length).toBe(0);
    expect(invoke).toHaveBeenCalledWith('delete_file', expect.objectContaining({
      path: 'C:\\Projects\\Sarii.ana.bak'
    }));
  });

  it('discards all snapshots and removes local storage key', async () => {
    const nodes = [{ id: 'node-1', data: { label: 'Source' } }];

    await AutoRecoveryService.saveRecoverySnapshot('tab-1', 'P1', nodes, [], 'C:\\P1.ana');
    await AutoRecoveryService.saveRecoverySnapshot('tab-2', 'P2', nodes, [], 'C:\\P2.ana');

    expect(AutoRecoveryService.getPendingRecoverySnapshots().length).toBe(2);

    await AutoRecoveryService.discardAllSnapshots();

    expect(AutoRecoveryService.getPendingRecoverySnapshots().length).toBe(0);
  });
});
