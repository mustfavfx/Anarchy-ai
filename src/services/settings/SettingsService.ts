/**
 * Settings Service - Centralized settings management
 * Reads from localStorage
 */

export interface AppSettings {
  theme: 'dark' | 'light';
  notifications: boolean;
  soundEffects: boolean;
  saveLocation: string;
  defaultModel: string;
  defaultUpscale: boolean;
  maxHistory: number;
  clearOnExit: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  notifications: true,
  soundEffects: false,
  saveLocation: '',
  defaultModel: 'black-forest-labs/flux-2-pro',
  defaultUpscale: false,
  maxHistory: 500,
  clearOnExit: false,
};

const STORAGE_KEY = 'anarchy_settings';

export const SettingsService = {
  /**
   * Initialize settings
   */
  async init(): Promise<void> {
    // No-op — secure key loading removed (API key is now server-side only)
  },

  /**
   * Apply theme classes to document body
   */
  applyTheme(theme: 'dark' | 'light'): void {
    const isDark = theme !== 'light';
    document.body.classList.toggle('dark-theme', isDark);
    document.body.classList.toggle('light-theme', !isDark);
  },

  /**
   * Get current settings (merged with defaults)
   */
  getSettings(): AppSettings {
    let settings = DEFAULT_SETTINGS;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        settings = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      }
    } catch {
      // Ignore parse errors
    }
    return settings;
  },

  /**
   * Get a specific setting value
   */
  get<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return this.getSettings()[key];
  },

  /**
   * Update settings (auto-saves to localStorage)
   */
  updateSettings(updates: Partial<AppSettings>): void {
    const current = this.getSettings();
    const merged = { ...current, ...updates };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch (err) {
      console.warn('[SettingsService] Failed to save settings to localStorage:', err);
    }

    if (updates.theme !== undefined) {
      this.applyTheme(updates.theme);
    }
  },

  /**
   * Reset all settings to default values
   */
  async resetSettings(): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
      this.applyTheme(DEFAULT_SETTINGS.theme);
    } catch (err) {
      console.warn('[SettingsService] Failed to reset settings:', err);
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
