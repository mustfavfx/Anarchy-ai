/**
 * Settings Service - Centralized settings management
 * Reads from secure OS keyring and localStorage
 */

export interface AppSettings {
  theme: 'dark' | 'light';
  notifications: boolean;
  soundEffects: boolean;
  saveLocation: string;
  apiKey: string;
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
  apiKey: '',
  defaultModel: 'black-forest-labs/flux-2-pro',
  defaultUpscale: false,
  maxHistory: 500,
  clearOnExit: false,
};

const STORAGE_KEY = 'anarchy_settings';
const SECURE_KEY_SERVICE = 'anarchy_replicate_api_key';

let cachedApiKey: string | null = null;
let isKeyLoaded = false;

export const SettingsService = {
  /**
   * Initialize secure settings by loading the API Key from OS secure storage
   */
  async init(): Promise<void> {
    if (isKeyLoaded) return;
    try {
      const isTauri = typeof window !== 'undefined' && (!!(window as any).__TAURI_IPC__ || !!(window as any).__TAURI_METADATA__);
      if (isTauri) {
        const { invoke } = await import('@tauri-apps/api/core');
        const key = await invoke<string>('load_secure_key', { service: SECURE_KEY_SERVICE });
        cachedApiKey = key || '';
      } else {
        // Fallback for web dev/testing
        cachedApiKey = localStorage.getItem('anarchy_secure_api_key') || '';
      }
    } catch (err) {
      console.error('[SettingsService] Failed to load secure API key:', err);
      cachedApiKey = '';
    }
    isKeyLoaded = true;
  },

  /**
   * Save the API Key to secure storage (keyring / fallback)
   */
  async saveSecureApiKey(key: string): Promise<void> {
    cachedApiKey = key;
    try {
      const isTauri = typeof window !== 'undefined' && (!!(window as any).__TAURI_IPC__ || !!(window as any).__TAURI_METADATA__);
      if (isTauri) {
        const { invoke } = await import('@tauri-apps/api/core');
        if (key) {
          await invoke('save_secure_key', { service: SECURE_KEY_SERVICE, key });
        } else {
          await invoke('delete_secure_key', { service: SECURE_KEY_SERVICE });
        }
      } else {
        localStorage.setItem('anarchy_secure_api_key', key);
      }
    } catch (err) {
      console.error('[SettingsService] Failed to save secure API key:', err);
    }
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
   * Get current settings (merged with defaults and secure API key)
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
    // Overlay the cached secure API key if it's loaded
    settings.apiKey = cachedApiKey !== null ? cachedApiKey : (settings.apiKey || '');
    return settings;
  },

  /**
   * Get a specific setting value
   */
  get<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return this.getSettings()[key];
  },

  /**
   * Update settings (auto-saves non-secure to localStorage, secure key to keyring)
   */
  updateSettings(updates: Partial<AppSettings>): void {
    const current = this.getSettings();
    const merged = { ...current, ...updates };

    if (updates.apiKey !== undefined) {
      this.saveSecureApiKey(updates.apiKey);
    }

    // Strip apiKey from localStorage object for security
    const toSave = { ...merged, apiKey: '' };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, apiKey: '' }));
      await this.saveSecureApiKey('');
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
