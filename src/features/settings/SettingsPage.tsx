import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Settings, Shield, Database,
  Check,
  Save, RefreshCw, Trash2, Info,
  Zap, History, Bell, FileText,
  Download, Upload, X, ExternalLink, Lock
} from 'lucide-react';
import { replicateService } from '../../services/replicate';
import { DataMigrationService } from '../../services/migration';
import { useAIConfigStore } from '../../stores/aiConfigStore';
import type { WatermarkPosition } from '../../stores/aiConfigStore';
import { ConfirmModal } from '../../components/ConfirmModal';
import './SettingsPage.css';

interface AppSettings {
  theme: 'dark' | 'light';
  language: string;
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
  language: 'en',
  notifications: true,
  soundEffects: false,
  saveLocation: '',
  apiKey: '',
  defaultModel: 'google/nano-banana-2',
  defaultUpscale: false,
  maxHistory: 500,
  clearOnExit: false,
};

export const SettingsPage: React.FC = () => {
  const aiConfig = useAIConfigStore((s) => s.config);
  const setAIConfig = useAIConfigStore((s) => s.setConfig);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState<'general' | 'storage' | 'about'>('general');
  const [saved, setSaved] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showDocsModal, setShowDocsModal] = useState(false);
  const [showChangelogModal, setShowChangelogModal] = useState(false);
  const [diskUsage, setDiskUsage] = useState({ projects: 0, history: 0, total: 0 });
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'up-to-date' | 'error'>('idle');
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmClearData, setConfirmClearData] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [appVersion, setAppVersion] = useState('...');

  useEffect(() => {
    import('@tauri-apps/api/app')
      .then(m => m.getVersion())
      .then(v => setAppVersion(v))
      .catch(() => setAppVersion('0.7.0'));
  }, []);

  const checkForUpdates = useCallback(async () => {
    setUpdateStatus('checking');
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke<{ shouldUpdate: boolean }>('check_update');
      setUpdateStatus(result?.shouldUpdate ? 'available' : 'up-to-date');
      setTimeout(() => setUpdateStatus('idle'), 4000);
    } catch {
      setUpdateStatus('error');
      setTimeout(() => setUpdateStatus('idle'), 3000);
    }
  }, []);

  // Load settings
  useEffect(() => {
    const saved = localStorage.getItem('anarchy_settings');
    if (saved) {
      setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
    }
    calculateDiskUsage();
  }, []);

  // Apply theme effect - comprehensive variables
  useEffect(() => {
    const root = document.documentElement;
    const isDark = settings.theme !== 'light';
    
    if (isDark) {
      // Dark Theme
      root.style.setProperty('--bg-app', '#0a0a0b');
      root.style.setProperty('--bg-side', '#000000');
      root.style.setProperty('--bg-surface', '#121214');
      root.style.setProperty('--bg-card', '#161618');
      root.style.setProperty('--bg-input', '#0a0a0b');
      root.style.setProperty('--text-primary', '#ffffff');
      root.style.setProperty('--text-secondary', '#9ca3af');
      root.style.setProperty('--text-muted', '#6b7280');
      root.style.setProperty('--border-color', 'rgba(255, 255, 255, 0.08)');
      root.style.setProperty('--border-hover', 'rgba(255, 255, 255, 0.15)');
      root.style.setProperty('--card-bg', 'rgba(255, 255, 255, 0.02)');
      root.style.setProperty('--card-border', 'rgba(255, 255, 255, 0.04)');
      root.style.setProperty('--hover-bg', 'rgba(255, 255, 255, 0.05)');
      root.style.setProperty('--shadow-sm', '0 2px 8px rgba(0, 0, 0, 0.3)');
      root.style.setProperty('--shadow-md', '0 4px 16px rgba(0, 0, 0, 0.4)');
      root.style.setProperty('--shadow-lg', '0 8px 32px rgba(0, 0, 0, 0.5)');
      document.body.style.backgroundColor = '#0a0a0b';
      document.body.classList.remove('light-theme');
      document.body.classList.add('dark-theme');
    } else {
      // Light Theme
      root.style.setProperty('--bg-app', '#f8fafc');
      root.style.setProperty('--bg-side', '#f1f5f9');
      root.style.setProperty('--bg-surface', '#ffffff');
      root.style.setProperty('--bg-card', '#ffffff');
      root.style.setProperty('--bg-input', '#f8fafc');
      root.style.setProperty('--text-primary', '#0f172a');
      root.style.setProperty('--text-secondary', '#475569');
      root.style.setProperty('--text-muted', '#94a3b8');
      root.style.setProperty('--border-color', '#e2e8f0');
      root.style.setProperty('--border-hover', '#cbd5e1');
      root.style.setProperty('--card-bg', '#ffffff');
      root.style.setProperty('--card-border', '#e2e8f0');
      root.style.setProperty('--hover-bg', '#f1f5f9');
      root.style.setProperty('--shadow-sm', '0 2px 8px rgba(0, 0, 0, 0.08)');
      root.style.setProperty('--shadow-md', '0 4px 16px rgba(0, 0, 0, 0.1)');
      root.style.setProperty('--shadow-lg', '0 8px 32px rgba(0, 0, 0, 0.15)');
      document.body.style.backgroundColor = '#f8fafc';
      document.body.classList.remove('dark-theme');
      document.body.classList.add('light-theme');
    }
  }, [settings.theme]);

  const calculateDiskUsage = () => {
    // Calculate rough estimate from localStorage
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        total += localStorage.getItem(key)?.length || 0;
      }
    }
    const history = localStorage.getItem('anarchy_history')?.length || 0;
    const projects = total - history;
    setDiskUsage({
      projects: Math.round(projects / 1024),
      history: Math.round(history / 1024),
      total: Math.round(total / 1024)
    });
  };

  const saveSettings = () => {
    localStorage.setItem('anarchy_settings', JSON.stringify(settings));
    // Update Replicate service with new API key
    replicateService.updateApiKey();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const resetSettings = () => setConfirmReset(true);

  const doResetSettings = () => {
    setConfirmReset(false);
    setSettings(DEFAULT_SETTINGS);
    localStorage.setItem('anarchy_settings', JSON.stringify(DEFAULT_SETTINGS));
    replicateService.updateApiKey();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const clearAllData = () => setConfirmClearData(true);

  const doClearAllData = () => {
    setConfirmClearData(false);
    localStorage.clear();
    setSettings(DEFAULT_SETTINGS);
    calculateDiskUsage();
  };

  // Export/Import handlers
  const handleExport = () => {
    DataMigrationService.exportToFile();
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const success = await DataMigrationService.importFromFile(file);
    if (success) {
      alert('✅ Data imported successfully! Please reload the app.');
      // Reload settings
      const saved = localStorage.getItem('anarchy_settings');
      if (saved) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
      }
      calculateDiskUsage();
    } else {
      alert('❌ Failed to import data. Please check the file format.');
    }
    // Reset input
    e.target.value = '';
  };

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <div className="settings-title-row">
          <Settings size={22} className="settings-icon" />
          <h1 className="page-title">Settings</h1>
        </div>
        <div className="settings-actions">
          <button className="btn-secondary" onClick={resetSettings}>
            <RefreshCw size={14} />
            Reset
          </button>
          <button className="btn-primary" onClick={saveSettings}>
            {saved ? <Check size={14} /> : <Save size={14} />}
            {saved ? 'Saved!' : 'Save'}
          </button>
        </div>
      </div>

      <div className="settings-layout">
        {/* Sidebar */}
        <div className="settings-sidebar">
          {[
            { id: 'general', label: 'General', icon: <Settings size={16} /> },
            { id: 'storage', label: 'Storage', icon: <Database size={16} /> },
            { id: 'about', label: 'About', icon: <Info size={16} /> },
          ].map(tab => (
            <button
              key={tab.id}
              className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id as any)}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="settings-content">
          {/* General */}
          {activeTab === 'general' && (
            <>
              {/* Notifications Card */}
              <div className="settings-card">
                <div className="settings-card-header">
                  <Bell size={18} className="card-icon" />
                  <h3>Notifications</h3>
                </div>

                <div className="setting-item">
                  <div className="setting-item-content">
                    <label>Enable Notifications</label>
                    <span className="setting-desc">Show toast notifications for completed generations</span>
                  </div>
                  <div className="setting-control">
                    <button
                      className={`toggle-switch ${settings.notifications ? 'on' : ''}`}
                      onClick={() => updateSetting('notifications', !settings.notifications)}
                    />
                  </div>
                </div>

                <div className="setting-item">
                  <div className="setting-item-content">
                    <label>Sound Effects</label>
                    <span className="setting-desc">Play sound on generation complete</span>
                  </div>
                  <div className="setting-control">
                    <button
                      className={`toggle-switch ${settings.soundEffects ? 'on' : ''}`}
                      onClick={() => updateSetting('soundEffects', !settings.soundEffects)}
                    />
                  </div>
                </div>
              </div>

              {/* Watermark Card */}
              <div className="settings-card wm-card">
                <div className="settings-card-header">
                  <FileText size={18} className="card-icon" />
                  <h3>Watermark</h3>
                  <div className="wm-header-toggle">
                    <button
                      className={`toggle-switch ${aiConfig.enableWatermark ? 'on' : ''}`}
                      onClick={() => setAIConfig(prev => ({ ...prev, enableWatermark: !prev.enableWatermark }))}
                    />
                  </div>
                </div>

                {aiConfig.enableWatermark && (
                  <div className="wm-body">

                    {/* Type selector tabs */}
                    <div className="wm-type-tabs">
                      <button
                        className={`wm-type-tab ${(aiConfig.watermarkType || 'text') === 'text' ? 'active' : ''}`}
                        onClick={() => setAIConfig(prev => ({ ...prev, watermarkType: 'text' }))}
                      >
                        <span className="wm-tab-icon">T</span> Text
                      </button>
                      <button
                        className={`wm-type-tab ${aiConfig.watermarkType === 'image' ? 'active' : ''}`}
                        onClick={() => setAIConfig(prev => ({ ...prev, watermarkType: 'image' }))}
                      >
                        <span className="wm-tab-icon">⬜</span> Image (PNG)
                      </button>
                    </div>

                    {/* Text mode */}
                    {(aiConfig.watermarkType || 'text') === 'text' && (
                      <div className="wm-section">
                        <label className="wm-label">Watermark Text</label>
                        <input
                          type="text"
                          className="wm-input"
                          value={aiConfig.watermarkText || ''}
                          onChange={e => setAIConfig(prev => ({ ...prev, watermarkText: e.target.value }))}
                          placeholder="e.g. © Anarchy AI"
                        />
                      </div>
                    )}

                    {/* Image mode */}
                    {aiConfig.watermarkType === 'image' && (
                      <div className="wm-section">
                        <label className="wm-label">PNG Logo / Signature</label>
                        <div className="wm-image-upload" onClick={() => {
                          const inp = document.createElement('input');
                          inp.type = 'file'; inp.accept = 'image/png,image/svg+xml,image/*';
                          inp.onchange = (ev) => {
                            const f = (ev.target as HTMLInputElement).files?.[0];
                            if (!f) return;
                            const reader = new FileReader();
                            reader.onload = (e) => setAIConfig(prev => ({ ...prev, watermarkImage: e.target?.result as string }));
                            reader.readAsDataURL(f);
                          };
                          inp.click();
                        }}>
                          {aiConfig.watermarkImage ? (
                            <div className="wm-image-preview-wrap">
                              <img src={aiConfig.watermarkImage} className="wm-image-preview" alt="watermark" />
                              <button className="wm-image-remove" onClick={e => { e.stopPropagation(); setAIConfig(prev => ({ ...prev, watermarkImage: '' })); }}>✕</button>
                            </div>
                          ) : (
                            <div className="wm-image-placeholder">
                              <Upload size={20} />
                              <span>Click to upload PNG</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Position */}
                    <div className="wm-section">
                      <label className="wm-label">Position</label>
                      <div className="wm-position-grid">
                        {[
                          { v: 'top-left', label: '↖' }, { v: 'top-center', label: '↑' }, { v: 'top-right', label: '↗' },
                          { v: 'center', label: '·' },
                          { v: 'bottom-left', label: '↙' }, { v: 'bottom-center', label: '↓' }, { v: 'bottom-right', label: '↘' },
                        ].map(p => (
                          <button
                            key={p.v}
                            className={`wm-pos-btn ${(aiConfig.watermarkPosition || 'bottom-right') === p.v ? 'active' : ''}`}
                            title={p.v.replaceAll('-', ' ')}
                            onClick={() => setAIConfig(prev => ({ ...prev, watermarkPosition: p.v as WatermarkPosition }))}
                          >{p.label}</button>
                        ))}
                      </div>
                    </div>

                    {/* Sliders row */}
                    <div className="wm-sliders">
                      <div className="wm-slider-item">
                        <div className="wm-slider-header">
                          <span className="wm-label">Opacity</span>
                          <span className="wm-slider-val">{((aiConfig.watermarkOpacity || 0.5) * 100).toFixed(0)}%</span>
                        </div>
                        <input type="range" min="0" max="1" step="0.05"
                          className="wm-slider"
                          value={aiConfig.watermarkOpacity || 0.5}
                          onChange={e => setAIConfig(prev => ({ ...prev, watermarkOpacity: Number.parseFloat(e.target.value) }))}
                        />
                        <div className="wm-opacity-preview" style={{ opacity: aiConfig.watermarkOpacity || 0.5 }}>
                          <span>Preview</span>
                        </div>
                      </div>

                      {(aiConfig.watermarkType || 'text') === 'text' ? (
                        <div className="wm-slider-item">
                          <div className="wm-slider-header">
                            <span className="wm-label">Font Size</span>
                            <span className="wm-slider-val">{aiConfig.watermarkFontSize || 24}px</span>
                          </div>
                          <input type="range" min="12" max="72" step="2"
                            className="wm-slider"
                            value={aiConfig.watermarkFontSize || 24}
                            onChange={e => setAIConfig(prev => ({ ...prev, watermarkFontSize: Number.parseInt(e.target.value) }))}
                          />
                          <div className="wm-size-preview">
                            <span style={{ fontSize: Math.min(aiConfig.watermarkFontSize || 24, 28) }}>
                              {aiConfig.watermarkText || 'Anarchy AI'}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="wm-slider-item">
                          <div className="wm-slider-header">
                            <span className="wm-label">Image Size</span>
                            <span className="wm-slider-val">{aiConfig.watermarkImageSize || 80}px</span>
                          </div>
                          <input type="range" min="20" max="300" step="10"
                            className="wm-slider"
                            value={aiConfig.watermarkImageSize || 80}
                            onChange={e => setAIConfig(prev => ({ ...prev, watermarkImageSize: Number.parseInt(e.target.value) }))}
                          />
                          {aiConfig.watermarkImage && (
                            <div className="wm-size-preview">
                              <img src={aiConfig.watermarkImage} alt="size preview"
                                style={{ width: Math.min(aiConfig.watermarkImageSize || 80, 120), opacity: aiConfig.watermarkOpacity || 0.5 }} />
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                  </div>
                )}
              </div>

              {/* Workflow Card */}
              <div className="settings-card">
                <div className="settings-card-header">
                  <Zap size={18} className="card-icon" />
                  <h3>Workflow</h3>
                </div>

                <div className="setting-item">
                  <div className="setting-item-content full-width">
                    <label>Save Location</label>
                    <span className="setting-desc">Default folder for saving projects</span>
                    <div className="save-location-input-group">
                      <input
                        type="text"
                        className="setting-input save-location-input"
                        value={settings.saveLocation}
                        onChange={e => updateSetting('saveLocation', e.target.value)}
                        placeholder="Select save location..."
                        readOnly
                      />
                      <button 
                        className="btn-secondary browse-btn"
                        onClick={() => {
                          // Open folder picker - will be implemented with Tauri
                          console.log('Browse for save location');
                        }}
                      >
                        Browse
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Storage */}
          {activeTab === 'storage' && (
            <>
              {/* Storage Usage Card */}
              <div className="settings-card">
                <div className="settings-card-header">
                  <Database size={18} className="card-icon" />
                  <h3>Storage Usage</h3>
                </div>

                <div className="storage-visual">
                  <div 
                    className="storage-pie"
                    style={{
                      ['--projects-deg' as any]: `${(diskUsage.projects / (diskUsage.total || 1)) * 360}deg`,
                      ['--total-deg' as any]: '360deg'
                    }}
                  >
                    <div className="storage-pie-center">
                      <span>{diskUsage.total} KB</span>
                    </div>
                  </div>
                  <div className="storage-breakdown">
                    <div className="storage-item">
                      <div className="storage-dot projects" />
                      <span className="storage-label">Projects</span>
                      <span className="storage-value">{diskUsage.projects} KB</span>
                    </div>
                    <div className="storage-item">
                      <div className="storage-dot history" />
                      <span className="storage-label">History</span>
                      <span className="storage-value">{diskUsage.history} KB</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Data Transfer Card */}
              <div className="settings-card">
                <div className="settings-card-header">
                  <Download size={18} className="card-icon" />
                  <h3>Data Transfer</h3>
                </div>
                <div className="setting-item">
                  <div className="setting-item-content">
                    <label>Export Data</label>
                    <span className="setting-desc">Download all your data (settings, history, projects) as a JSON file for backup or transfer to another device.</span>
                  </div>
                  <button className="btn-secondary" onClick={handleExport}>
                    <Download size={14} />
                    Export
                  </button>
                </div>
                <div className="setting-item">
                  <div className="setting-item-content">
                    <label>Import Data</label>
                    <span className="setting-desc">Restore data from a previously exported JSON file. This will merge with existing data.</span>
                  </div>
                  <label className="btn-secondary file-input-label">
                    <Upload size={14} />
                    Import
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImport}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
              </div>

              {/* Data Management Card */}
              <div className="danger-zone">
                <div className="danger-zone-header">
                  <Shield size={16} />
                  <h4>Data Management</h4>
                </div>
                <div className="danger-item">
                  <div className="setting-item-content">
                    <label className="danger-label">Clear All Data</label>
                    <span className="setting-desc">Delete all projects, history, and settings. This cannot be undone.</span>
                  </div>
                  <button className="btn-danger" onClick={clearAllData}>
                    <Trash2 size={14} />
                    Clear All
                  </button>
                </div>
              </div>
            </>
          )}

          {/* About */}
          {activeTab === 'about' && (
            <>
            {/* Application Version Card */}
            <div className="settings-card version-card">
              <div className="version-row">
                <div className="version-info">
                  <div className="version-icon">
                    <Info size={18} />
                  </div>
                  <div className="version-text">
                    <span className="version-label">Application Version</span>
                    <span className="version-number">{appVersion}</span>
                  </div>
                </div>
                <button 
                  className={`version-check-btn ${updateStatus}`}
                  onClick={checkForUpdates}
                  disabled={updateStatus === 'checking'}
                >
                  {updateStatus === 'checking' && <RefreshCw size={14} className="spin" />}
                  {updateStatus === 'idle' && 'Check for Updates'}
                  {updateStatus === 'checking' && 'Checking...'}
                  {updateStatus === 'up-to-date' && 'Up to Date ✓'}
                  {updateStatus === 'available' && 'Update Available'}
                  {updateStatus === 'error' && 'Try Again'}
                </button>
              </div>
            </div>

            <div className="settings-card about-card">
              <div className="about-logo-large">A</div>
              <h2>Anarchy AI</h2>
              <span className="about-version-badge">Version {appVersion}</span>

              <p className="about-description">
                AI-powered architectural visualization and design assistant.
                Built for architects, by architects.
              </p>

              <div className="about-links-grid">
                <button className="about-link-card" onClick={() => setShowDocsModal(true)}>
                  <FileText size={20} />
                  Documentation
                </button>
                <button className="about-link-card" onClick={() => setShowChangelogModal(true)}>
                  <History size={20} />
                  Changelog
                </button>
                <button className="about-link-card" onClick={() => setShowPrivacyModal(true)}>
                  <Shield size={20} />
                  Privacy Policy
                </button>
              </div>

              <div className="about-developer-section">
                <p className="about-developer-text">
                  Developed by <span className="about-developer-name">Architect Mustafa Hisham</span>
                  <span className="about-separator"> • </span>
                  <a
                    href="https://www.instagram.com/mustafa_hisham.1/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="about-social-link"
                  >Instagram</a>
                  <span className="about-separator"> • </span>
                  <a
                    href="https://www.behance.net/Mustafa_VFX"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="about-social-link"
                  >Behance</a>
                  <span className="about-separator"> • </span>
                  <a
                    href="https://t.me/Mustafa_VFX"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="about-social-link"
                  >Telegram</a>
                </p>
              </div>

              <div className="about-credits-footer">
                <p>Built with React, Tauri, and Vite</p>
              </div>
            </div>
            </>
          )}
        </div>
      </div>

      {/* Privacy Policy Modal */}
      {showPrivacyModal && (
        <div className="privacy-modal-overlay" onClick={() => setShowPrivacyModal(false)}>
          <div className="privacy-modal" onClick={(e) => e.stopPropagation()}>
            <div className="privacy-modal-header">
              <div className="privacy-modal-title">
                <Shield size={24} />
                <h2>Privacy Policy & Terms of Use</h2>
              </div>
              <button className="privacy-modal-close" onClick={() => setShowPrivacyModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="privacy-modal-content">
              <div className="privacy-section">
                <h3><Lock size={16} /> Privacy Policy</h3>
                <p><strong>Anarchy AI</strong> is designed with privacy in mind. All your data stays on your device.</p>
                
                <h4>Local Data (Stored on Your Device Only)</h4>
                <ul>
                  <li><strong>App Settings:</strong> Theme, language, notifications</li>
                  <li><strong>Project Data:</strong> Your projects and workflows</li>
                  <li><strong>History:</strong> Generation history</li>
                  <li><strong>Library:</strong> Your saved assets</li>
                </ul>
                <p className="privacy-highlight">Important: All data is stored locally. We do not store your data on any external servers.</p>

                <h4>AI Processing</h4>
                <ul>
                  <li><strong>AI Generation:</strong> Prompts sent for AI image generation</li>
                  <li><strong>API Token:</strong> Stored locally in .env file</li>
                </ul>

                <h4>Your Rights</h4>
                <div className="privacy-rights">
                  <span>✅ Export all data</span>
                  <span>✅ Delete all data</span>
                  <span>✅ Transfer to another device</span>
                  <span>✅ Use offline</span>
                </div>
              </div>

              <div className="privacy-section">
                <h3><FileText size={16} /> Terms of Use</h3>
                <p>By using Anarchy AI, you agree to these terms.</p>
                
                <h4>License</h4>
                <div className="privacy-license">
                  <p>✅ <strong>Personal Use:</strong> Free for personal and professional work</p>
                  <p>✅ <strong>Commercial Use:</strong> Allowed for client projects</p>
                  <p>❌ <strong>Redistribution:</strong> Do not redistribute the application</p>
                  <p>❌ <strong>Reverse Engineering:</strong> Do not modify or reverse engineer</p>
                </div>

                <h4>User Responsibilities</h4>
                <ul>
                  <li>Maintain your own AI service account</li>
                  <li>Ensure content complies with local laws</li>
                  <li>Respect intellectual property rights</li>
                  <li>Keep API tokens secure</li>
                </ul>
              </div>

              <div className="privacy-section">
                <h3>📧 Contact</h3>
                <p className="privacy-dev-name">Developer: Architect Mustafa Hisham</p>
                <div className="privacy-contact-links">
                  <a href="https://www.instagram.com/mustafa_hisham.1/" target="_blank" rel="noopener noreferrer">
                    <ExternalLink size={14} /> Instagram
                  </a>
                  <a href="https://www.behance.net/Mustafa_VFX" target="_blank" rel="noopener noreferrer">
                    <ExternalLink size={14} /> Behance
                  </a>
                  <a href="https://t.me/Mustafa_VFX" target="_blank" rel="noopener noreferrer">
                    <ExternalLink size={14} /> Telegram
                  </a>
                </div>
              </div>

              <div className="privacy-footer-text">
                <p>🔒 Your data stays on your device</p>
                <p>🎨 Use for any architectural project</p>
                <p>Last updated: April 27, 2026</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Documentation Modal */}
      {showDocsModal && (
        <div className="privacy-modal-overlay" onClick={() => setShowDocsModal(false)}>
          <div className="privacy-modal" onClick={(e) => e.stopPropagation()}>
            <div className="privacy-modal-header">
              <div className="privacy-modal-title">
                <FileText size={24} />
                <h2>Documentation</h2>
              </div>
              <button className="privacy-modal-close" onClick={() => setShowDocsModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="privacy-modal-content">
              <div className="privacy-section">
                <h3>🚀 Getting Started</h3>
                <p>Anarchy AI is an AI-powered architectural visualization tool designed for architects and designers.</p>
              </div>

              <div className="privacy-section">
                <h3>📋 Key Features</h3>
                <ul className="privacy-list">
                  <li><strong>AI Image Generation:</strong> Generate architectural renders using Replicate AI models</li>
                  <li><strong>Workflow Builder:</strong> Create node-based workflows for complex operations</li>
                  <li><strong>Batch Processing:</strong> Process multiple images with different settings</li>
                  <li><strong>Upscale Models:</strong> Enhance image resolution with various upscalers</li>
                  <li><strong>Compare Mode:</strong> Side-by-side comparison of different generations</li>
                </ul>
              </div>

              <div className="privacy-section">
                <h3>🎨 Using the Builder</h3>
                <ul className="privacy-list">
                  <li>Drag to pan the canvas</li>
                  <li>Scroll to zoom in/out</li>
                  <li>Double-click empty space to add nodes</li>
                  <li>Connect nodes by dragging from output to input</li>
                  <li>Select nodes to view and edit their settings</li>
                </ul>
              </div>

              <div className="privacy-section">
                <h3>⌨️ Keyboard Shortcuts</h3>
                <ul className="privacy-list">
                  <li><strong>Ctrl+S:</strong> Save workflow</li>
                  <li><strong>Ctrl+O:</strong> Open workflow</li>
                  <li><strong>Delete:</strong> Remove selected node</li>
                  <li><strong>Space:</strong> Fit view to all nodes</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Changelog Modal */}
      {showChangelogModal && (
        <div className="privacy-modal-overlay" onClick={() => setShowChangelogModal(false)}>
          <div className="privacy-modal" onClick={(e) => e.stopPropagation()}>
            <div className="privacy-modal-header">
              <div className="privacy-modal-title">
                <History size={24} />
                <h2>Changelog</h2>
              </div>
              <button className="privacy-modal-close" onClick={() => setShowChangelogModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="privacy-modal-content">
              <div className="privacy-section">
                <h3>Version 0.1.121</h3>
                <ul className="privacy-list">
                  <li>Added Replicate API integration for image generation</li>
                  <li>Support for multiple AI models (nano-banana, flux, etc.)</li>
                  <li>Implemented workflow builder with ReactFlow</li>
                  <li>Added batch processing capabilities</li>
                  <li>New upscale models support (Real-ESRGAN, Clarity)</li>
                  <li>Improved canvas performance and smoothness</li>
                  <li>Added swap view functionality for preview panel</li>
                  <li>New settings page with version checker</li>
                </ul>
              </div>

              <div className="privacy-section">
                <h3>Version 0.1.0</h3>
                <ul className="privacy-list">
                  <li>Initial release of Anarchy AI</li>
                  <li>Basic image generation features</li>
                  <li>Simple workflow builder</li>
                  <li>Project management system</li>
                </ul>
              </div>

              <div className="privacy-footer-text">
                <p>🔄 Stay updated for new features</p>
                <p>Last updated: April 27, 2026</p>
              </div>
            </div>
          </div>
        </div>
      )}
      {confirmReset && (
        <ConfirmModal
          title="Reset Settings"
          message="Reset all settings to defaults? Your API key and preferences will be cleared."
          confirmLabel="Reset"
          danger
          onConfirm={doResetSettings}
          onCancel={() => setConfirmReset(false)}
        />
      )}
      {confirmClearData && (
        <ConfirmModal
          title="Clear All Data"
          message={`This will permanently delete:\n• All projects\n• All history\n• All settings\n\nThis cannot be undone!`}
          confirmLabel="Clear Everything"
          danger
          onConfirm={doClearAllData}
          onCancel={() => setConfirmClearData(false)}
        />
      )}
    </div>
  );
};
