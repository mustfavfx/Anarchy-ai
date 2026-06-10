import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  addHistoryEntry,
  getHistory,
  getHistoryGrouped,
  toggleStar,
  deleteHistoryEntry,
  getHistoryStats,
  formatDuration,
  getDateLabel,
} from './HistoryService';

// Mock SettingsService
vi.mock('../settings', () => ({
  SettingsService: { get: vi.fn(() => 500) },
}));

// Mock IndexedDB functions (they are async and use browser APIs)
vi.mock('./HistoryService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./HistoryService')>();
  return {
    ...actual,
    saveFullImage: vi.fn(),
    loadFullImage: vi.fn(() => Promise.resolve(null)),
    deleteFullImages: vi.fn(() => Promise.resolve()),
  };
});

const makeEntry = (overrides = {}) => ({
  type: 'render' as const,
  label: 'Test Entry',
  prompt: 'a beautiful landscape',
  ...overrides,
});

describe('HistoryService', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  // ── addHistoryEntry ────────────────────────────────────────────────────────
  describe('addHistoryEntry', () => {
    it('returns entry with generated id and timestamp', () => {
      const result = addHistoryEntry(makeEntry());
      expect(result.id).toMatch(/^h_\d+_/);
      expect(result.timestamp).toBeGreaterThan(0);
    });

    it('persists entry to localStorage', () => {
      addHistoryEntry(makeEntry({ label: 'Stored Entry' }));
      const stored = getHistory();
      expect(stored).toHaveLength(1);
      expect(stored[0].label).toBe('Stored Entry');
    });

    it('prepends newer entries (most recent first)', () => {
      addHistoryEntry(makeEntry({ label: 'First' }));
      addHistoryEntry(makeEntry({ label: 'Second' }));
      const history = getHistory();
      expect(history[0].label).toBe('Second');
      expect(history[1].label).toBe('First');
    });

    it('strips data URL images from localStorage entry', () => {
      addHistoryEntry(makeEntry({ outputImage: 'data:image/png;base64,abc123' }));
      const stored = getHistory();
      expect(stored[0].outputImage).toBeUndefined();
    });
  });

  // ── getHistory ─────────────────────────────────────────────────────────────
  describe('getHistory', () => {
    it('returns empty array when no entries exist', () => {
      expect(getHistory()).toEqual([]);
    });

    it('returns all stored entries', () => {
      addHistoryEntry(makeEntry({ label: 'A' }));
      addHistoryEntry(makeEntry({ label: 'B' }));
      expect(getHistory()).toHaveLength(2);
    });
  });

  // ── getHistoryGrouped ──────────────────────────────────────────────────────
  describe('getHistoryGrouped', () => {
    it('returns empty array when no entries', () => {
      expect(getHistoryGrouped()).toEqual([]);
    });

    it('groups entries by source lineage', () => {
      addHistoryEntry(makeEntry({ label: 'Today Entry' }));
      const groups = getHistoryGrouped();
      expect(groups).toHaveLength(1);
      expect(groups[0].children).toHaveLength(1);
    });
  });

  // ── toggleStar ─────────────────────────────────────────────────────────────
  describe('toggleStar', () => {
    it('stars an unstarred entry', () => {
      const entry = addHistoryEntry(makeEntry());
      toggleStar(entry.id);
      expect(getHistory()[0].starred).toBe(true);
    });

    it('unstars a starred entry', () => {
      const entry = addHistoryEntry(makeEntry({ starred: true }));
      toggleStar(entry.id);
      expect(getHistory()[0].starred).toBe(false);
    });

    it('does nothing for unknown id', () => {
      addHistoryEntry(makeEntry());
      toggleStar('nonexistent');
      expect(getHistory()).toHaveLength(1);
    });
  });

  // ── deleteHistoryEntry ─────────────────────────────────────────────────────
  describe('deleteHistoryEntry', () => {
    it('removes entry by id', () => {
      const entry = addHistoryEntry(makeEntry());
      deleteHistoryEntry(entry.id);
      expect(getHistory()).toHaveLength(0);
    });

    it('only removes the targeted entry', () => {
      addHistoryEntry(makeEntry({ label: 'Keep' }));
      const toDelete = addHistoryEntry(makeEntry({ label: 'Delete' }));
      deleteHistoryEntry(toDelete.id);
      const remaining = getHistory();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].label).toBe('Keep');
    });
  });

  // ── getHistoryStats ────────────────────────────────────────────────────────
  describe('getHistoryStats', () => {
    it('returns zeroes for empty history', () => {
      const stats = getHistoryStats();
      expect(stats.total).toBe(0);
      expect(stats.starred).toBe(0);
      expect(stats.totalDuration).toBe(0);
    });

    it('counts entries and starred correctly', () => {
      addHistoryEntry(makeEntry({ duration: 1000 }));
      const starred = addHistoryEntry(makeEntry({ duration: 2000 }));
      toggleStar(starred.id);
      const stats = getHistoryStats();
      expect(stats.total).toBe(2);
      expect(stats.starred).toBe(1);
      expect(stats.totalDuration).toBe(3000);
    });

    it('counts today entries', () => {
      addHistoryEntry(makeEntry());
      expect(getHistoryStats().todayCount).toBe(1);
    });
  });

  // ── formatDuration ─────────────────────────────────────────────────────────
  describe('formatDuration', () => {
    it('formats milliseconds', () => {
      expect(formatDuration(500)).toBe('500ms');
    });

    it('formats seconds', () => {
      expect(formatDuration(5000)).toBe('5s');
    });

    it('formats minutes and seconds', () => {
      expect(formatDuration(90000)).toBe('1m 30s');
    });
  });

  // ── getDateLabel ───────────────────────────────────────────────────────────
  describe('getDateLabel', () => {
    it('returns "Today" for current timestamp', () => {
      expect(getDateLabel(Date.now())).toBe('Today');
    });

    it('returns "Yesterday" for yesterday timestamp', () => {
      expect(getDateLabel(Date.now() - 86400000)).toBe('Yesterday');
    });

    it('returns days ago for recent dates', () => {
      const label = getDateLabel(Date.now() - 86400000 * 3);
      expect(label).toBe('3 days ago');
    });
  });
});
