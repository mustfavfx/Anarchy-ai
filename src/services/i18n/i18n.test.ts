import { describe, it, expect, beforeEach } from 'vitest';
import { t, setLanguage, getLanguage } from './index';

describe('i18n Service', () => {
  beforeEach(() => {
    localStorage.clear();
    setLanguage('en');
  });

  it('defaults to English', () => {
    expect(getLanguage()).toBe('en');
    expect(t('common.confirm')).toBe('Confirm');
  });

  it('enforces English interface language by design', () => {
    setLanguage('ar');
    expect(getLanguage()).toBe('en');
    expect(t('common.confirm')).toBe('Confirm');
  });

  it('falls back to English if key queried', () => {
    setLanguage('ar');
    expect(t('app.title')).toBe('Anarchy AI');
  });

  it('returns fallback or key if key is unknown', () => {
    expect(t('nonexistent.key', 'My Fallback')).toBe('My Fallback');
    expect(t('nonexistent.key')).toBe('nonexistent.key');
  });
});
