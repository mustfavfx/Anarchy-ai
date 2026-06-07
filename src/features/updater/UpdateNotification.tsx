import React, { useEffect, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Download, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import './UpdateNotification.css';

interface UpdateInfo {
  version: string;
  body: string | null;
  date: string | null;
}

type UpdateState = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'installing' | 'done' | 'error';

export const UpdateNotification: React.FC = () => {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [state, setState] = useState<UpdateState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const checkForUpdate = useCallback(async () => {
    setState('checking');
    setError(null);
    try {
      const result = await invoke<UpdateInfo | null>('check_update');
      if (result) {
        setUpdate(result);
        setState('available');
        // Auto-start download for mandatory update
        setTimeout(() => handleInstall(), 1000);
      } else {
        setState('idle');
      }
    } catch (e) {
      setState('idle');
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(checkForUpdate, 3000);
    return () => clearTimeout(timer);
  }, [checkForUpdate]);

  const handleInstall = async () => {
    setState('downloading');
    setError(null);
    
    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 15;
      });
    }, 500);
    
    try {
      await invoke('install_update');
      clearInterval(progressInterval);
      setProgress(100);
      setState('done');
      
      // Auto restart after 3 seconds
      setTimeout(() => {
        invoke('restart_app');
      }, 3000);
    } catch (e: any) {
      clearInterval(progressInterval);
      setError(e?.toString() ?? 'Update failed');
      setState('error');
    }
  };

  // Don't show anything while checking or no update
  if (state === 'idle' || state === 'checking') return null;

  return (
    <div className="mandatory-update-overlay">
      <div className="mandatory-update-modal">
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
                The application will update automatically.
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
                Please check your internet connection and restart the application.
              </p>
            </>
          )}
        </div>

        <div className="update-modal-footer">
          {(state === 'available' || state === 'error') && (
            <button className="update-btn-primary" onClick={handleInstall}>
              {state === 'available' ? (
                <>
                  <Download size={16} />
                  <span>Update Now</span>
                </>
              ) : (
                <>
                  <RefreshCw size={16} />
                  <span>Retry</span>
                </>
              )}
            </button>
          )}
          
          {(state === 'downloading' || state === 'installing') && (
            <div className="update-spinner">
              <RefreshCw size={20} className="spin" />
              <span>Installing...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
