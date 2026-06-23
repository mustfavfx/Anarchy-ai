import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Settings, Shield, Database,
  Check,
  Save, RefreshCw, Trash2, Info,
  Zap, History, Bell, FileText,
  Download, Upload, Activity
} from 'lucide-react';
import { DataMigrationService } from '../../services/migration';
import { useAIConfigStore } from '../../stores/aiConfigStore';
import type { WatermarkPosition } from '../../stores/aiConfigStore';
import { ConfirmModal } from '../../shared/components/ConfirmModal';
import { notify } from '../../stores/notificationStore';
import './SettingsPage.css';
import { APP_INFO } from '../../config/appInfo';
import { SettingsService, type AppSettings } from '../../services/settings';
import { PrivacyPolicyModal, ChangelogModal } from './SettingsModals';
import { supabase, isSupabaseConfigured, supabaseUrl } from '../../services/supabase/supabaseClient';
import { useBuilderQueueStore } from '../../stores/builderQueueStore';

export const SettingsPage: React.FC = () => {
  const aiConfig = useAIConfigStore((s) => s.config);
  const setAIConfig = useAIConfigStore((s) => s.setConfig);
  const [settings, setSettings] = useState<AppSettings>(SettingsService.getSettings());
  const [activeTab, setActiveTab] = useState<'general' | 'storage' | 'about' | 'health'>('general');
  const [saved, setSaved] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showChangelogModal, setShowChangelogModal] = useState(false);
  const [diskUsage, setDiskUsage] = useState({ projects: 0, history: 0, total: 0 });
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'up-to-date' | 'error'>('idle');
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmClearData, setConfirmClearData] = useState(false);
  const [appVersion, setAppVersion] = useState('...');
  
  // System Health States
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'error' | 'not-configured'>('checking');
  const [replicateStatus, setReplicateStatus] = useState<'checking' | 'active' | 'error' | 'not-configured'>('checking');
  const [storageStatus, setStorageStatus] = useState<'checking' | 'healthy' | 'error'>('checking');
  const [pingTime, setPingTime] = useState<number | null>(null);

  const queueLength = useBuilderQueueStore((s) => s.activeQueue.length);
  const isQueueExecuting = useBuilderQueueStore((s) => s.isExecuting);

  const checkSystemHealth = useCallback(async () => {
    // 1. Check Database Status
    if (!isSupabaseConfigured) {
      setDbStatus('not-configured');
    } else {
      setDbStatus('checking');
      const start = performance.now();
      try {
        const { error } = await supabase.auth.getSession();
        if (error) {
          setDbStatus('error');
        } else {
          setDbStatus('connected');
          setPingTime(Math.round(performance.now() - start));
        }
      } catch {
        setDbStatus('error');
      }
    }

    // 2. Check Replicate Status
    if (!isSupabaseConfigured) {
      setReplicateStatus('not-configured');
    } else {
      setReplicateStatus('checking');
      try {
        const urlObj = new URL(supabaseUrl);
        const replicateWebhook = `https://${urlObj.hostname}/functions/v1/replicate_webhook`;
        const res = await fetch(replicateWebhook, { method: 'HEAD' });
        if (res.status >= 200 && res.status < 500) {
          setReplicateStatus('active');
        } else {
          setReplicateStatus('error');
        }
      } catch {
        setReplicateStatus('error');
      }
    }

    // 3. Check Storage Status
    setStorageStatus('checking');
    try {
      if (window.indexedDB) {
        setStorageStatus('healthy');
      } else {
        setStorageStatus('error');
      }
    } catch {
      setStorageStatus('error');
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'health') {
      checkSystemHealth();
    }
  }, [activeTab, checkSystemHealth]);

  const watermarkFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    import('@tauri-apps/api/app')
      .then(m => m.getVersion())
      .then(v => {
        if (typeof v === 'string') {
          setAppVersion(v);
        } else if (v && typeof v === 'object' && 'version' in v) {
          setAppVersion(String((v as any).version));
        } else {
          setAppVersion(String(v));
        }
      })
      .catch(() => setAppVersion('0.7.0'));
  }, []);

  const checkForUpdates = useCallback(async () => {
    if (updateStatus === 'available') {
      setUpdateStatus('checking');
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('install_update');
        await invoke('restart_app');
      } catch (err) {
        notify.error('Update failed', String(err));
        setUpdateStatus('error');
        setTimeout(() => setUpdateStatus('idle'), 3000);
      }
      return;
    }

    setUpdateStatus('checking');
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke('check_update') as unknown;
      const shouldUpdate = result !== null && typeof result === 'object';
      setUpdateStatus(shouldUpdate ? 'available' : 'up-to-date');
      if (!shouldUpdate) {
        setTimeout(() => setUpdateStatus('idle'), 4000);
      }
    } catch {
      setUpdateStatus('error');
      setTimeout(() => setUpdateStatus('idle'), 3000);
    }
  }, [updateStatus]);

  const calculateDiskUsage = useCallback(() => {
    // Calculate estimate from localStorage (UTF-16 uses 2 bytes per character)
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        total += (localStorage.getItem(key)?.length || 0) * 2;
      }
    }
    const history = (localStorage.getItem('anarchy_history')?.length || 0) * 2;
    const projects = total - history;
    setDiskUsage({
      projects: Math.round(projects / 1024),
      history: Math.round(history / 1024),
      total: Math.round(total / 1024)
    });
  }, []);

  // Initialize and load secure settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      await SettingsService.init();
      const current = SettingsService.getSettings();
      setSettings(current);
      SettingsService.applyTheme(current.theme);
      calculateDiskUsage();
    };
    loadSettings();
  }, [calculateDiskUsage]);

  const saveSettings = () => {
    SettingsService.updateSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const resetSettings = () => setConfirmReset(true);

  const doResetSettings = async () => {
    setConfirmReset(false);
    await SettingsService.resetSettings();
    const current = SettingsService.getSettings();
    setSettings(current);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const clearAllData = () => setConfirmClearData(true);

  const doClearAllData = async () => {
    setConfirmClearData(false);
    localStorage.clear();
    await SettingsService.resetSettings();
    const current = SettingsService.getSettings();
    setSettings(current);
    calculateDiskUsage();
  };

  // Export/Import handlers
  const handleExport = async () => {
    await DataMigrationService.exportToFile();
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const success = await DataMigrationService.importFromFile(file);
    if (success) {
      notify.success('Data imported successfully!', 'Please reload the app.');
      // Reload settings
      await SettingsService.init();
      setSettings(SettingsService.getSettings());
      calculateDiskUsage();
    } else {
      notify.error('Failed to import data.', 'Please check the file format.');
    }
    // Reset input
    e.target.value = '';
  };

  const updateSetting = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => {
      const updated = { ...prev, [key]: value };
      // Auto-save setting immediately on update
      SettingsService.updateSettings({ [key]: value });
      return updated;
    });
  }, []);

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
            { id: 'general' as const, label: 'General', icon: <Settings size={16} /> },
            { id: 'storage' as const, label: 'Storage', icon: <Database size={16} /> },
            { id: 'health' as const, label: 'System Health', icon: <Activity size={16} /> },
            { id: 'about' as const, label: 'About', icon: <Info size={16} /> },
          ].map(tab => (
            <button
              key={tab.id}
              className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
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
                        <input
                          type="file"
                          ref={watermarkFileInputRef}
                          accept="image/png,image/svg+xml,image/*"
                          onChange={(ev) => {
                            const f = ev.target.files?.[0];
                            if (!f) return;
                            const reader = new FileReader();
                            reader.onload = (e) => setAIConfig(prev => ({ ...prev, watermarkImage: e.target?.result as string }));
                            reader.readAsDataURL(f);
                            ev.target.value = '';
                          }}
                          style={{ display: 'none' }}
                        />
                        <div className="wm-image-upload" onClick={() => watermarkFileInputRef.current?.click()}>
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
                            <span className="wm-slider-val">{aiConfig.watermarkImageSize || 20}%</span>
                          </div>
                          <input type="range" min="5" max="80" step="5"
                            className="wm-slider"
                            value={aiConfig.watermarkImageSize || 20}
                            onChange={e => setAIConfig(prev => ({ ...prev, watermarkImageSize: Number.parseInt(e.target.value) }))}
                          />
                          {aiConfig.watermarkImage && (
                            <div className="wm-size-preview">
                              <img src={aiConfig.watermarkImage} alt="size preview"
                                style={{ width: `${aiConfig.watermarkImageSize || 20}%`, maxWidth: 120, opacity: aiConfig.watermarkOpacity || 0.5 }} />
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
                        placeholder="Default: App data folder"
                        readOnly
                      />
                      <button 
                        className="btn-secondary browse-btn"
                        onClick={async () => {
                          try {
                            const { open } = await import('@tauri-apps/plugin-dialog');
                            const selected = await open({ directory: true, multiple: false });
                            if (selected && typeof selected === 'string') {
                              updateSetting('saveLocation', selected);
                            }
                          } catch { /* cancelled or unavailable */ }
                        }}
                      >
                        Browse
                      </button>
                      {settings.saveLocation && (
                        <button
                          className="btn-secondary"
                          title="Clear"
                          onClick={() => updateSetting('saveLocation', '')}
                          style={{ padding: '0 8px' }}
                        >
                          ✕
                        </button>
                      )}
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
                      '--projects-deg': `${(diskUsage.projects / (diskUsage.total || 1)) * 360}deg`,
                      '--total-deg': '360deg',
                    } as React.CSSProperties}
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
                <p className="storage-disclaimer">
                  * Note: Storage size is an estimate based on local application database states.
                </p>
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

          {/* System Health */}
          {activeTab === 'health' && (
            <>
              <div className="settings-card">
                <div className="settings-card-header">
                  <Activity size={18} className="card-icon" />
                  <h3>System Health & Subsystems</h3>
                  <button 
                    className="btn-secondary" 
                    onClick={checkSystemHealth}
                    style={{ marginLeft: 'auto', height: 30, padding: '0 12px', fontSize: 11, minWidth: 'auto' }}
                    disabled={dbStatus === 'checking' || replicateStatus === 'checking'}
                  >
                    <RefreshCw size={12} className={dbStatus === 'checking' ? 'spin' : ''} />
                    Refresh Status
                  </button>
                </div>

                <div className="setting-item">
                  <div className="setting-item-content">
                    <label>Application Version</label>
                    <span className="setting-desc">Current release version and build tag</span>
                  </div>
                  <span className="setting-value" style={{ fontFamily: 'monospace' }}>v{appVersion}</span>
                </div>

                <div className="setting-item">
                  <div className="setting-item-content">
                    <label>Build Target</label>
                    <span className="setting-desc">Vite compiler environment mode</span>
                  </div>
                  <span className="setting-value" style={{ textTransform: 'capitalize' }}>
                    {import.meta.env.MODE} ({import.meta.env.DEV ? 'Dev' : 'Production'})
                  </span>
                </div>

                <div className="setting-item">
                  <div className="setting-item-content">
                    <label>Database Connection (Supabase)</label>
                    <span className="setting-desc">Status of the remote Supabase PostgreSQL database</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {pingTime !== null && dbStatus === 'connected' && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{pingTime}ms ping</span>
                    )}
                    <span className={`status-badge ${dbStatus}`}>
                      {dbStatus === 'checking' && 'Checking...'}
                      {dbStatus === 'connected' && 'Connected (Healthy)'}
                      {dbStatus === 'error' && 'Connection Error'}
                      {dbStatus === 'not-configured' && 'Not Configured (Offline Mode)'}
                    </span>
                  </div>
                </div>

                <div className="setting-item">
                  <div className="setting-item-content">
                    <label>Replicate API Status</label>
                    <span className="setting-desc">Connectivity to Replicate AI generation endpoints</span>
                  </div>
                  <span className={`status-badge ${replicateStatus}`}>
                    {replicateStatus === 'checking' && 'Checking...'}
                    {replicateStatus === 'active' && 'Active (Reachable)'}
                    {replicateStatus === 'error' && 'Service Unreachable'}
                    {replicateStatus === 'not-configured' && 'Not Configured (Supabase Missing)'}
                  </span>
                </div>

                <div className="setting-item">
                  <div className="setting-item-content">
                    <label>Local Storage (IndexedDB)</label>
                    <span className="setting-desc">Availability of local browser database for workflows and images</span>
                  </div>
                  <span className={`status-badge ${storageStatus === 'healthy' ? 'connected' : storageStatus === 'checking' ? 'checking' : 'error'}`}>
                    {storageStatus === 'checking' && 'Checking...'}
                    {storageStatus === 'healthy' && 'Healthy'}
                    {storageStatus === 'error' && 'Unavailable'}
                  </span>
                </div>

                <div className="setting-item">
                  <div className="setting-item-content">
                    <label>Generation Background Queue</label>
                    <span className="setting-desc">Status of the local asynchronous task scheduler</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {queueLength > 0 && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{queueLength} job(s) pending</span>
                    )}
                    <span className={`status-badge ${isQueueExecuting ? 'connected' : 'idle'}`}>
                      {isQueueExecuting ? 'Active Execution' : 'Idle (Waiting)'}
                    </span>
                  </div>
                </div>

                <div className="setting-item">
                  <div className="setting-item-content">
                    <label>Telemetry & Diagnostics</label>
                    <span className="setting-desc">Export system diagnostic bundles and crash telemetry logs for debugging</span>
                  </div>
                  <button 
                    type="button"
                    className="btn-secondary"
                    onClick={async () => {
                      try {
                        const { DiagnosticBundleService } = await import('../../services/monitoring/DiagnosticBundleService');
                        await DiagnosticBundleService.export();
                        notify.success('Diagnostics Exported', 'Bundle downloaded successfully.');
                      } catch (err) {
                        notify.error('Export Failed', err instanceof Error ? err.message : 'Unknown error');
                      }
                    }}
                    style={{ height: 32, padding: '0 16px', fontSize: 12 }}
                  >
                    Export Bundle
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
                  {updateStatus === 'available' && 'Install & Restart'}
                  {updateStatus === 'error' && 'Try Again'}
                </button>
              </div>
            </div>

            <div className="settings-card about-card">
              <div className="about-logo-large">A</div>
              <h2>{APP_INFO.name}</h2>
              <span className="about-version-badge">Version {appVersion}</span>

              <p className="about-description">{APP_INFO.description}</p>

              <div className="about-links-grid">
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
                  Developed by <span className="about-developer-name">{APP_INFO.developer}</span>
                  <span className="about-separator"> • </span>
                  <a href={APP_INFO.links.instagram} target="_blank" rel="noopener noreferrer" className="about-social-link">Instagram</a>
                  <span className="about-separator"> • </span>
                  <a href={APP_INFO.links.website} target="_blank" rel="noopener noreferrer" className="about-social-link">Website</a>
                  <span className="about-separator"> • </span>
                  <a href={APP_INFO.links.telegram} target="_blank" rel="noopener noreferrer" className="about-social-link">Telegram</a>
                </p>
              </div>

              <div className="about-credits-footer">
                <p>Built with {APP_INFO.builtWith}</p>
              </div>
            </div>
            </>
          )}
        </div>
      </div>

      {/* Privacy Policy Modal */}
      {showPrivacyModal && <PrivacyPolicyModal onClose={() => setShowPrivacyModal(false)} />}

      {/* Changelog Modal */}
      {showChangelogModal && <ChangelogModal onClose={() => setShowChangelogModal(false)} />}

      {confirmReset && (
        <ConfirmModal
          title="Reset Settings"
          message="Reset all settings to defaults? Your preferences will be reset."
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
