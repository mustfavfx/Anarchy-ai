import { describe, it, expect, beforeEach } from 'vitest';
import { t, setLanguage, getLanguage, LANGUAGE_STORAGE_KEY } from './index';

describe('i18n Service', () => {
  beforeEach(() => {
    localStorage.clear();
    setLanguage('en');
  });

  it('defaults to English', () => {
    expect(getLanguage()).toBe('en');
    expect(t('common.confirm')).toBe('Confirm');
  });

  it('translates correctly when language is switched to Arabic', () => {
    setLanguage('ar');
    expect(getLanguage()).toBe('ar');
    expect(t('common.confirm')).toBe('تأكيد');
  });

  it('falls back to English if key missing in Arabic', () => {
    setLanguage('ar');
    expect(t('app.title')).toBe('Anarchy AI');
  });

  it('returns fallback or key if key is unknown', () => {
    expect(t('nonexistent.key', 'My Fallback')).toBe('My Fallback');
    expect(t('nonexistent.key')).toBe('nonexistent.key');
  });
});
