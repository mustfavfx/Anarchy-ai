import React, { useState, useEffect, useCallback } from 'react';
import { Settings, Database, Info, Check, Save, RefreshCw } from 'lucide-react';
import { DataMigrationService } from '../../services/migration';
import { ConfirmModal } from '../../shared/components/ConfirmModal';
import { notify } from '../../stores/notificationStore';
import './SettingsPage.css';
import { SettingsService, type AppSettings } from '../../services/settings';
import { PrivacyPolicyModal, ChangelogModal } from './SettingsModals';
import { supabase, isSupabaseConfigured, supabaseUrl } from '../../services/supabase/supabaseClient';
import { useBuilderQueueStore } from '../../stores/builderQueueStore';
import { SupportModal } from '../dashboard/SupportModal';
import { useTranslation } from '../../services/i18n';
import { StorageManagerService, type StorageMetrics } from '../../services/storage/StorageManagerService';
import { GeneralSettingsTab } from './tabs/GeneralSettingsTab';
import { StorageSettingsTab } from './tabs/StorageSettingsTab';
import { SystemHealthTab } from './tabs/SystemHealthTab';
import { AboutTab } from './tabs/AboutTab';

export const SettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<AppSettings>(SettingsService.getSettings());
  const [activeTab, setActiveTab] = useState<'general' | 'storage' | 'about' | 'health'>('general');
  const [saved, setSaved] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showChangelogModal, setShowChangelogModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [diskUsage, setDiskUsage] = useState({ projects: 0, history: 0, total: 0 });
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'up-to-date' | 'error'>('idle');
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmClearData, setConfirmClearData] = useState(false);
  const [confirmCleanCache, setConfirmCleanCache] = useState(false);
  const [isCleaningCache, setIsCleaningCache] = useState(false);
  const [storageMetrics, setStorageMetrics] = useState<StorageMetrics | null>(null);
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
      .catch(() => setAppVersion('0.3.90'));
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
    } catch (err) {
      console.error('Update check failed:', err);
      notify.error('Update Check Failed', String(err));
      setUpdateStatus('error');
      setTimeout(() => setUpdateStatus('idle'), 5000);
    }
  }, [updateStatus]);

  const calculateDiskUsage = useCallback(() => {
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

  const loadStorageMetrics = useCallback(async () => {
    try {
      const metrics = await StorageManagerService.getStorageMetrics();
      setStorageMetrics(metrics);
    } catch (err) {
      console.warn('[SettingsPage] Failed to load storage metrics:', err);
    }
  }, []);

  // Initialize and load secure settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      await SettingsService.init();
      const current = SettingsService.getSettings();
      setSettings(current);
      SettingsService.applyTheme(current.theme);
      calculateDiskUsage();
      loadStorageMetrics();
    };
    loadSettings();
  }, [calculateDiskUsage, loadStorageMetrics]);

  useEffect(() => {
    if (activeTab === 'storage') {
      loadStorageMetrics();
    }
  }, [activeTab, loadStorageMetrics]);

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
    loadStorageMetrics();
  };

  const doCleanImageCache = async () => {
    setConfirmCleanCache(false);
    setIsCleaningCache(true);
    try {
      const { freedBytes, freedCount } = await StorageManagerService.cleanImageCache();
      await loadStorageMetrics();
      calculateDiskUsage();
      const freedMb = (freedBytes / (1024 * 1024)).toFixed(1);
      notify.success('Cache Cleaned Successfully', `Freed ${freedCount} cached images (${freedMb} MB). Your projects remain safe.`);
    } catch (err: any) {
      notify.error('Cache Clean Failed', err?.message || 'Could not clean image cache.');
    } finally {
      setIsCleaningCache(false);
    }
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
      await SettingsService.init();
      setSettings(SettingsService.getSettings());
      calculateDiskUsage();
    } else {
      notify.error('Failed to import data.', 'Please check the file format.');
    }
    e.target.value = '';
  };

  const updateSetting = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => {
      const updated = { ...prev, [key]: value };
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
          {activeTab === 'general' && (
            <GeneralSettingsTab
              settings={settings}
              updateSetting={updateSetting}
              onOpenSupportModal={() => setShowSupportModal(true)}
            />
          )}

          {activeTab === 'storage' && (
            <StorageSettingsTab
              storageMetrics={storageMetrics}
              diskUsage={diskUsage}
              loadStorageMetrics={loadStorageMetrics}
              isCleaningCache={isCleaningCache}
              onCleanCache={() => setConfirmCleanCache(true)}
              onExportData={handleExport}
              onImportData={handleImport}
              onClearAllData={clearAllData}
              t={t}
            />
          )}

          {activeTab === 'health' && (
            <SystemHealthTab
              dbStatus={dbStatus}
              replicateStatus={replicateStatus}
              storageStatus={storageStatus}
              pingTime={pingTime}
              appVersion={appVersion}
              queueLength={queueLength}
              isQueueExecuting={isQueueExecuting}
              onRefreshHealth={checkSystemHealth}
            />
          )}

          {activeTab === 'about' && (
            <AboutTab
              appVersion={appVersion}
              updateStatus={updateStatus}
              onCheckForUpdates={checkForUpdates}
              onOpenChangelogModal={() => setShowChangelogModal(true)}
              onOpenPrivacyModal={() => setShowPrivacyModal(true)}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      {showPrivacyModal && <PrivacyPolicyModal onClose={() => setShowPrivacyModal(false)} />}
      {showChangelogModal && <ChangelogModal onClose={() => setShowChangelogModal(false)} />}
      {showSupportModal && (
        <SupportModal isOpen={showSupportModal} onClose={() => setShowSupportModal(false)} />
      )}

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
          title={t('settings.clearCacheConfirmTitle', 'Clear Local Cache & Preferences')}
          message={t('settings.clearCacheConfirmMsg', 'This will reset your local UI preferences, stored cache, and settings to defaults.\n\nYour project files (.ana) and generated assets on disk will NOT be deleted.')}
          confirmLabel={t('settings.clearCacheBtn', 'Clear Cache')}
          danger
          onConfirm={doClearAllData}
          onCancel={() => setConfirmClearData(false)}
        />
      )}
      {confirmCleanCache && (
        <ConfirmModal
          title="Clean Image Cache"
          message="Are you sure you want to clean the temporary image cache in IndexedDB?&#10;&#10;This will purge ephemeral cached image previews to free up disk space. Your .ana project files and active canvas nodes will remain 100% safe."
          confirmLabel="Clean Image Cache"
          danger
          onConfirm={doCleanImageCache}
          onCancel={() => setConfirmCleanCache(false)}
        />
      )}
    </div>
  );
};
export default SettingsPage;
