import React, { useEffect, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Download, X, RefreshCw, CheckCircle } from 'lucide-react';
import './UpdateNotification.css';

interface UpdateInfo {
  version: string;
  body: string | null;
  date: string | null;
}

type UpdateState = 'idle' | 'checking' | 'available' | 'downloading' | 'done' | 'error';

export const UpdateNotification: React.FC = () => {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [state, setState] = useState<UpdateState>('idle');
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkForUpdate = useCallback(async () => {
    setState('checking');
    setError(null);
    try {
      const result = await invoke<UpdateInfo | null>('check_update');
      if (result) {
        setUpdate(result);
        setState('available');
      } else {
        setState('idle');
      }
    } catch (e) {
      setState('idle');
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(checkForUpdate, 5000);
    return () => clearTimeout(timer);
  }, [checkForUpdate]);

  const handleInstall = async () => {
    setState('downloading');
    setError(null);
    try {
      await invoke('install_update');
      setState('done');
    } catch (e: any) {
      setError(e?.toString() ?? 'Update failed');
      setState('error');
    }
  };

  if (dismissed || state === 'idle' || state === 'checking') return null;

  return (
    <div className={`update-banner ${state}`}>
      <div className="update-banner-icon">
        {state === 'done' ? (
          <CheckCircle size={16} />
        ) : state === 'downloading' ? (
          <RefreshCw size={16} className="spin" />
        ) : (
          <Download size={16} />
        )}
      </div>

      <div className="update-banner-content">
        {state === 'available' && update && (
          <>
            <span className="update-banner-title">Update available — v{update.version}</span>
            {update.body && (
              <span className="update-banner-body">{update.body}</span>
            )}
          </>
        )}
        {state === 'downloading' && (
          <span className="update-banner-title">Downloading update…</span>
        )}
        {state === 'done' && (
          <span className="update-banner-title">Update ready — restart to apply</span>
        )}
        {state === 'error' && (
          <span className="update-banner-title">Update failed: {error}</span>
        )}
      </div>

      <div className="update-banner-actions">
        {state === 'available' && (
          <button className="update-btn-install" onClick={handleInstall}>
            Install
          </button>
        )}
        {(state === 'available' || state === 'error' || state === 'done') && (
          <button className="update-btn-dismiss" onClick={() => setDismissed(true)}>
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
};
