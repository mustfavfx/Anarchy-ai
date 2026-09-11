import React from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { notify } from '../../../stores/notificationStore';

interface SystemHealthTabProps {
  dbStatus: 'checking' | 'connected' | 'error' | 'not-configured';
  replicateStatus: 'checking' | 'active' | 'error' | 'not-configured';
  storageStatus: 'checking' | 'healthy' | 'error';
  pingTime: number | null;
  appVersion: string;
  queueLength: number;
  isQueueExecuting: boolean;
  onRefreshHealth: () => void;
}

export const SystemHealthTab: React.FC<SystemHealthTabProps> = ({
  dbStatus,
  replicateStatus,
  storageStatus,
  pingTime,
  appVersion,
  queueLength,
  isQueueExecuting,
  onRefreshHealth,
}) => {
  return (
    <div className="settings-card">
      <div className="settings-card-header">
        <Activity size={18} className="card-icon" />
        <h3>System Health & Subsystems</h3>
        <button 
          className="btn-secondary" 
          onClick={onRefreshHealth}
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
              const { DiagnosticBundleService } = await import('../../../services/monitoring/DiagnosticBundleService');
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
  );
};
