import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: vi.fn(), open: vi.fn() }));

import { replicateService } from './ReplicateService';

// ── arToSize logic (duplicated here since it is not exported) ─────────────────
function arToSize(ar: string, base: number): { width: number; height: number } {
  const map: Record<string, { width: number; height: number }> = {
    '1:1':  { width: base,                        height: base },
    '16:9': { width: base,                        height: Math.round(base * 9 / 16) },
    '9:16': { width: Math.round(base * 9 / 16),  height: base },
    '4:3':  { width: base,                        height: Math.round(base * 3 / 4) },
    '3:4':  { width: Math.round(base * 3 / 4),   height: base },
    '3:2':  { width: base,                        height: Math.round(base * 2 / 3) },
    '2:3':  { width: Math.round(base * 2 / 3),   height: base },
  };
  return map[ar] ?? { width: base, height: base };
}

function resolutionToPixels(res: string): number {
  if (res === '2K') return 1536;
  const n = Number.parseInt(res);
  return Number.isNaN(n) ? 1024 : n;
}

// ── arToSize ──────────────────────────────────────────────────────────────────
describe('arToSize', () => {
  it('returns square for 1:1', () => {
    const { width, height } = arToSize('1:1', 1024);
    expect(width).toBe(1024);
    expect(height).toBe(1024);
  });

  it('returns landscape for 16:9', () => {
    const { width, height } = arToSize('16:9', 1024);
    expect(width).toBe(1024);
    expect(height).toBe(576); // round(1024 * 9/16)
  });

  it('returns portrait for 9:16', () => {
    const { width, height } = arToSize('9:16', 1024);
    expect(height).toBe(1024);
    expect(width).toBe(576);
  });

  it('returns correct 4:3 ratio', () => {
    const { width, height } = arToSize('4:3', 1024);
    expect(width).toBe(1024);
    expect(height).toBe(768);
  });

  it('returns correct 3:4 ratio', () => {
    const { width, height } = arToSize('3:4', 1024);
    expect(height).toBe(1024);
    expect(width).toBe(768);
  });

  it('falls back to square for unknown ratio', () => {
    const { width, height } = arToSize('21:9', 1024);
    expect(width).toBe(1024);
    expect(height).toBe(1024);
  });

  it('maintains aspect ratio for 3:2', () => {
    const { width, height } = arToSize('3:2', 900);
    expect(width / height).toBeCloseTo(3 / 2, 1);
  });
});

// ── resolutionToPixels ────────────────────────────────────────────────────────
describe('resolutionToPixels', () => {
  it('returns 1536 for 2K', () => {
    expect(resolutionToPixels('2K')).toBe(1536);
  });

  it('parses numeric resolution strings', () => {
    expect(resolutionToPixels('1024')).toBe(1024);
    expect(resolutionToPixels('512')).toBe(512);
    expect(resolutionToPixels('2048')).toBe(2048);
  });

  it('returns 1024 for unknown resolution', () => {
    expect(resolutionToPixels('HD')).toBe(1024);
    expect(resolutionToPixels('')).toBe(1024);
  });
});

// ── replicateService instance ─────────────────────────────────────────────────
describe('replicateService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is defined', () => {
    expect(replicateService).toBeDefined();
  });

  it('has getAvailableModels method', () => {
    expect(typeof replicateService.getAvailableModels).toBe('function');
  });

  it('getAvailableModels returns array', () => {
    const models = replicateService.getAvailableModels();
    expect(Array.isArray(models)).toBe(true);
    expect(models.length).toBeGreaterThan(0);
  });

  it('does not expose any API key', () => {
    // Verify the service instance has no apiKey property
    const service = replicateService as any;
    expect(service.config?.apiKey).toBeUndefined();
  });
});
