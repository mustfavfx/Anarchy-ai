/**
 * Settings Service - Centralized settings management
 * Reads from localStorage and provides defaults
 */

export interface AppSettings {
  theme: 'dark' | 'light' | 'system';
  language: string;
  notifications: boolean;
  soundEffects: boolean;
  autoSave: boolean;
  apiKey: string;
  defaultModel: string;
  defaultUpscale: boolean;
  maxHistory: number;
  clearOnExit: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  language: 'en',
  notifications: true,
  soundEffects: false,
  autoSave: true,
  apiKey: '',
  defaultModel: 'google/nano-banana-2',
  defaultUpscale: false,
  maxHistory: 500,
  clearOnExit: false,
};

const STORAGE_KEY = 'anarchy_settings';

export const SettingsService = {
  /**
   * Get current settings (merged with defaults)
   */
  getSettings(): AppSettings {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      }
    } catch {
      // Ignore parse errors
    }
    return DEFAULT_SETTINGS;
  },

  /**
   * Get a specific setting value
   */
  get<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return this.getSettings()[key];
  },

  /**
   * Check if auto-save is enabled
   */
  isAutoSaveEnabled(): boolean {
    return this.get('autoSave');
  },

  /**
   * Get the default model
   */
  getDefaultModel(): string {
    return this.get('defaultModel');
  },

  /**
   * Check if auto-upscale is enabled
   */
  isAutoUpscaleEnabled(): boolean {
    return this.get('defaultUpscale');
  },

  /**
   * Check if notifications are enabled
   */
  isNotificationsEnabled(): boolean {
    return this.get('notifications');
  },

  /**
   * Check if sound effects are enabled
   */
  isSoundEnabled(): boolean {
    return this.get('soundEffects');
  },

  /**
   * Get current theme
   */
  getTheme(): 'dark' | 'light' | 'system' {
    return this.get('theme');
  },

  /**
   * Check if dark mode is active (handles system preference)
   */
  isDarkMode(): boolean {
    const theme = this.getTheme();
    if (theme === 'dark') return true;
    if (theme === 'light') return false;
    // System preference
    return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  },

  /**
   * Update settings
   */
  updateSettings(updates: Partial<AppSettings>): void {
    const current = this.getSettings();
    const merged = { ...current, ...updates };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch (err) {
      console.warn('[SettingsService] Failed to save settings to localStorage:', err);
    }
  },

  /**
   * Listen for settings changes (for cross-tab sync)
   */
  onChange(callback: (settings: AppSettings) => void): () => void {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        callback(this.getSettings());
      }
    };
    globalThis.addEventListener('storage', handler);
    return () => globalThis.removeEventListener('storage', handler);
  }
};

export default SettingsService;
