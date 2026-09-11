import React, { useEffect, useState, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Download, RefreshCw, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { logger } from '../../utils/logger';
import './UpdateNotification.css';

interface UpdateInfo {
  version: string;
  body: string | null;
  date: string | null;
}

type UpdateState = 'idle' | 'checking' | 'available' | 'downloading' | 'installing' | 'done' | 'error';

export const UpdateNotification: React.FC = () => {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [state, setState] = useState<UpdateState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const isCheckingRef = useRef(false);

  const checkForUpdate = useCallback(async () => {
    if (isCheckingRef.current) return;
    isCheckingRef.current = true;
    try {
      const result = await invoke<UpdateInfo | null>('check_update');
      if (result && result.version) {
        setUpdate(result);
        setState('available');
        // Do NOT auto-install! Keep modal visible until user clicks "Update Now"
      } else {
        setState('idle');
      }
    } catch (e) {
      // In web browser or dev mode without updater, remain idle
      setState('idle');
    } finally {
      isCheckingRef.current = false;
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(checkForUpdate, 1500);
    return () => clearTimeout(timer);
  }, [checkForUpdate]);

  const handleInstall = async () => {
    setState('downloading');
    setError(null);
    setProgress(5);
    
    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 92) return prev;
        return prev + Math.random() * 8 + 2;
      });
    }, 400);
    
    try {
      await invoke('install_update');
      clearInterval(progressInterval);
      setProgress(100);
      setState('done');
      
      // Auto restart after 2.5 seconds
      setTimeout(() => {
        invoke('restart_app');
      }, 2500);
    } catch (e: any) {
      clearInterval(progressInterval);
      const errMsg = e?.toString() ?? 'Update failed';
      logger.error('[Updater] Install error:', errMsg);
      setError(errMsg);
      setState('error');
    }
  };

  const handleManualDownload = () => {
    const downloadUrl = 'https://github.com/mustfavfx/Anarchy-ai/releases/latest';
    invoke('open_url', { url: downloadUrl }).catch(() => {
      window.open(downloadUrl, '_blank');
    });
  };

  // Don't show anything while checking or no update
  if (state === 'idle' || state === 'checking') return null;

  return (
    <div 
      className="mandatory-update-overlay"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="mandatory-update-modal" onClick={(e) => e.stopPropagation()}>
        <div className="update-modal-header">
          <div className="update-modal-icon">
            {state === 'done' ? (
              <CheckCircle size={32} className="icon-success" />
            ) : state === 'error' ? (
              <AlertCircle size={32} className="icon-error" />
            ) : (
              <Download size={32} className="icon-download" />
            )}
          </div>
          
          <h2 className="update-modal-title">
            {state === 'available' && 'Update Required'}
            {state === 'downloading' && 'Downloading Update...'}
            {state === 'installing' && 'Installing Update...'}
            {state === 'done' && 'Update Complete!'}
            {state === 'error' && 'Update Failed'}
          </h2>
        </div>

        <div className="update-modal-content">
          {state === 'available' && update && (
            <>
              <p className="update-version">Version {update.version} is available</p>
              <p className="update-message">
                A mandatory update is required to continue using Anarchy AI.
                Please click &quot;Update Now&quot; below to install the latest version.
              </p>
              {update.body && (
                <div className="update-changelog">
                  <h4>What&apos;s New:</h4>
                  <p>{update.body}</p>
                </div>
              )}
            </>
          )}

          {(state === 'downloading' || state === 'installing') && (
            <>
              <p className="update-message">Please wait while we download and install the update...</p>
              <div className="update-progress-container">
                <div 
                  className="update-progress-bar" 
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <p className="update-progress-text">{Math.round(Math.min(progress, 100))}%</p>
            </>
          )}

          {state === 'done' && (
            <>
              <p className="update-message">Update installed successfully!</p>
              <p className="update-restart-notice">
                The application will restart automatically in a few seconds...
              </p>
            </>
          )}

          {state === 'error' && (
            <>
              <p className="update-message error">Failed to install update: {error}</p>
              <p className="update-retry-hint">
                You can retry updating or download the installer directly from GitHub.
              </p>
            </>
          )}
        </div>

        <div className="update-modal-footer">
          {state === 'available' && (
            <button className="update-btn-primary" onClick={handleInstall}>
              <Download size={18} />
              <span>Update Now</span>
            </button>
          )}

          {state === 'error' && (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button className="update-btn-primary" onClick={handleInstall}>
                <RefreshCw size={16} />
                <span>Retry Update</span>
              </button>
              <button className="update-btn-secondary" onClick={handleManualDownload}>
                <ExternalLink size={16} />
                <span>Download Manually</span>
              </button>
            </div>
          )}
          
          {(state === 'downloading' || state === 'installing') && (
            <div className="update-spinner">
              <RefreshCw size={20} className="spin" />
              <span>Installing update...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
