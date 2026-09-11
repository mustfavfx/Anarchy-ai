import React from 'react';
import { Database, RefreshCw, Trash2, Download, Upload, Shield } from 'lucide-react';
import type { StorageMetrics } from '../../../services/storage/StorageManagerService';

interface StorageSettingsTabProps {
  storageMetrics: StorageMetrics | null;
  diskUsage: { projects: number; history: number; total: number };
  loadStorageMetrics: () => void;
  isCleaningCache: boolean;
  onCleanCache: () => void;
  onExportData: () => void;
  onImportData: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearAllData: () => void;
  t: (key: string, fallback?: string) => string;
}

export const StorageSettingsTab: React.FC<StorageSettingsTabProps> = ({
  storageMetrics,
  diskUsage,
  loadStorageMetrics,
  isCleaningCache,
  onCleanCache,
  onExportData,
  onImportData,
  onClearAllData,
  t,
}) => {
  return (
    <>
      {/* IndexedDB Image Cache & Storage Manager Card */}
      <div className="settings-card storage-cache-card">
        <div className="settings-card-header">
          <Database size={18} className="card-icon" style={{ color: '#38bdf8' }} />
          <div>
            <h3>Image Cache & IndexedDB Storage</h3>
            <p className="card-desc">Monitor local cached image data and free up disk space</p>
          </div>
          <button
            type="button"
            className="btn-secondary"
            onClick={loadStorageMetrics}
            style={{ marginLeft: 'auto', height: 28, padding: '0 10px', fontSize: 11 }}
            title="Refresh storage statistics"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>

        {/* Live Storage Progress Bar */}
        <div className="storage-meter-section" style={{ margin: '14px 0 16px' }}>
          <div className="storage-meter-labels" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>
            <span>Used: <strong style={{ color: '#fff' }}>{storageMetrics ? storageMetrics.formattedTotalUsage : `${diskUsage.total} KB`}</strong></span>
            <span>Quota: <strong style={{ color: '#fff' }}>{storageMetrics?.formattedQuota || 'Unlimited (Disk)'}</strong></span>
          </div>
          <div className="storage-progress-track" style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
            <div
              className="storage-progress-fill"
              style={{
                height: '100%',
                borderRadius: 4,
                width: `${Math.max(2, Math.min(100, storageMetrics?.percentUsed || 10))}%`,
                background: (storageMetrics?.percentUsed || 0) > 85 ? '#e11d48' : ((storageMetrics?.percentUsed || 0) > 65 ? '#f59e0b' : '#10b981'),
                transition: 'width 0.4s ease',
              }}
            />
          </div>
        </div>

        {/* Storage Metric Grid */}
        <div className="storage-metric-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 14 }}>
          <div className="storage-metric-box" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '12px 14px' }}>
            <div className="metric-title" style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>Temporary Image Cache</div>
            <div className="metric-val" style={{ fontSize: 18, fontWeight: 700, color: '#38bdf8' }}>
              {storageMetrics ? storageMetrics.formattedImageCache : '0 B'}
            </div>
            <div className="metric-sub" style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
              {storageMetrics?.imageCacheCount || 0} cached preview items
            </div>
          </div>

          <div className="storage-metric-box" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '12px 14px' }}>
            <div className="metric-title" style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>Stored Project Images</div>
            <div className="metric-val" style={{ fontSize: 18, fontWeight: 700, color: '#a855f7' }}>
              {storageMetrics ? ((storageMetrics.storedImagesBytes / (1024 * 1024)).toFixed(1) + ' MB') : '0 B'}
            </div>
            <div className="metric-sub" style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
              {storageMetrics?.storedImagesCount || 0} saved assets
            </div>
          </div>

          <div className="storage-metric-box" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '12px 14px' }}>
            <div className="metric-title" style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>Projects & Preferences</div>
            <div className="metric-val" style={{ fontSize: 18, fontWeight: 700, color: '#10b981' }}>
              {storageMetrics ? ((storageMetrics.projectsBytes / 1024).toFixed(1) + ' KB') : `${diskUsage.projects} KB`}
            </div>
            <div className="metric-sub" style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
              Workflows & tab states
            </div>
          </div>
        </div>

        {/* Cache Purge Action */}
        <div className="setting-item" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14, marginTop: 4 }}>
          <div className="setting-item-content">
            <label>Clean Image Cache (IndexedDB)</label>
            <span className="setting-desc">
              Purge temporary downloaded image previews from IndexedDB to reclaim disk space. Your .ana project files and active workflow nodes remain 100% safe.
            </span>
          </div>
          <button
            type="button"
            className="btn-secondary"
            onClick={onCleanCache}
            disabled={isCleaningCache || (storageMetrics?.imageCacheCount === 0 && storageMetrics?.imageCacheBytes === 0)}
            style={{ borderColor: 'rgba(56, 189, 248, 0.4)', color: '#38bdf8' }}
          >
            <Trash2 size={14} />
            {isCleaningCache ? 'Cleaning...' : 'Clean Image Cache'}
          </button>
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
          <button className="btn-secondary" onClick={onExportData}>
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
              onChange={onImportData}
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
            <label className="danger-label">{t('settings.clearCache', 'Clear Local Cache & Preferences')}</label>
            <span className="setting-desc">{t('settings.clearCacheDesc', 'Clears local preferences, session cache, and resets settings to defaults. Project files (.ana) on disk remain untouched.')}</span>
          </div>
          <button type="button" className="btn-danger" onClick={onClearAllData}>
            <Trash2 size={14} />
            {t('settings.clearCacheBtn', 'Clear Cache')}
          </button>
        </div>
      </div>
    </>
  );
};
