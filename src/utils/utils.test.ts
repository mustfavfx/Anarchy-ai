/**
 * Utils: logger & storageKeys Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── logger.ts ─────────────────────────────────────────────────────────────────
describe('logger', () => {
  let consoleSpy: {
    log: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
    debug: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should always log errors', async () => {
    const { logger } = await import('./logger');
    logger.error('test error');
    expect(consoleSpy.error).toHaveBeenCalledWith('test error');
  });

  it('should expose log, warn, error, debug methods', async () => {
    const { logger } = await import('./logger');
    expect(typeof logger.log).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });
});

// ── storageKeys.ts ────────────────────────────────────────────────────────────
describe('STORAGE_KEYS', () => {
  it('should have all required storage keys', async () => {
    const { STORAGE_KEYS } = await import('./storageKeys');
    expect(STORAGE_KEYS.BUILDER_AUTOSAVE).toBeDefined();
    expect(STORAGE_KEYS.HISTORY).toBeDefined();
    expect(STORAGE_KEYS.SETTINGS).toBeDefined();
    expect(STORAGE_KEYS.WATERMARK_CONFIG).toBeDefined();
    expect(STORAGE_KEYS.WATERMARK_IMAGE).toBeDefined();
    expect(STORAGE_KEYS.ACCOUNT).toBeDefined();
  });

  it('should have correct key values', async () => {
    const { STORAGE_KEYS } = await import('./storageKeys');
    expect(STORAGE_KEYS.HISTORY).toBe('anarchy_history');
    expect(STORAGE_KEYS.SETTINGS).toBe('anarchy_settings');
  });
});

describe('SESSION_KEYS', () => {
  it('should have all required session keys', async () => {
    const { SESSION_KEYS } = await import('./storageKeys');
    expect(SESSION_KEYS.PRESET_PROMPT).toBeDefined();
    expect(SESSION_KEYS.PRESET_IMAGE).toBeDefined();
    expect(SESSION_KEYS.PRESET_WORKFLOW).toBeDefined();
    expect(SESSION_KEYS.OPEN_PROJECT_PATH).toBeDefined();
    expect(SESSION_KEYS.LOADED_WORKFLOW).toBeDefined();
  });
});
