import React, { useState } from 'react';
import {
  X, History, Sparkles, Zap, CheckCircle,
  Clock, ChevronRight, Download, RefreshCw
} from 'lucide-react';
import './ChangelogModal.css';
import { CHANGELOG_DATA } from '../../config/changelogData';

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangelogModal: React.FC<ChangelogModalProps> = ({ isOpen, onClose }) => {
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'up-to-date' | 'error'>('idle');

  if (!isOpen) return null;

  const getFeatureIcon = (type: 'feature' | 'improvement' | 'fix') => {
    switch (type) {
      case 'feature':
        return <Sparkles size={16} />;
      case 'improvement':
        return <Zap size={16} />;
      case 'fix':
        return <CheckCircle size={16} />;
      default:
        return <Sparkles size={16} />;
    }
  };

  const currentVersion = CHANGELOG_DATA[0]?.version || 'v0.0.19';

  const handleUpdateClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (updateStatus === 'checking') return;

    if (updateStatus === 'available') {
      setUpdateStatus('checking');
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('install_update');
        await invoke('restart_app');
      } catch (err) {
        console.error('Update installation failed:', err);
        setUpdateStatus('error');
        setTimeout(() => setUpdateStatus('idle'), 3000);
      }
      return;
    }

    setUpdateStatus('checking');
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke('check_update');
      const shouldUpdate = result !== null && typeof result === 'object';
      setUpdateStatus(shouldUpdate ? 'available' : 'up-to-date');
      if (!shouldUpdate) {
        setTimeout(() => setUpdateStatus('idle'), 4000);
      }
    } catch (err) {
      console.error('Check update failed:', err);
      // Fallback: Open anarchy.lat in system default browser via Tauri invoke open_url
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('open_url', { url: 'https://anarchy.lat/' });
      } catch {
        window.open('https://anarchy.lat/', '_blank', 'noopener,noreferrer');
      }
      setUpdateStatus('error');
      setTimeout(() => setUpdateStatus('idle'), 3000);
    }
  };

  return (
    <div className="changelog-modal-overlay" onClick={onClose}>
      <div className="changelog-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="changelog-modal-header">
          <div className="changelog-modal-title-section">
            <History size={28} className="changelog-title-icon" />
            <div>
              <h2>Changelog</h2>
              <p>Version history and updates</p>
            </div>
          </div>
          <button className="changelog-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="changelog-modal-content">
          {/* Current Version Banner */}
          <div className="changelog-current-banner">
            <div className="current-version-badge">
              <span className="version-label">Current Version</span>
              <span className="version-number">{currentVersion}</span>
            </div>
            <button
              className="download-latest-btn"
              onClick={handleUpdateClick}
              disabled={updateStatus === 'checking'}
              style={{
                cursor: updateStatus === 'checking' ? 'not-allowed' : 'pointer',
                borderStyle: 'solid',
                ...(updateStatus === 'up-to-date' ? {
                  background: 'rgba(34, 197, 94, 0.15)',
                  borderColor: 'rgba(34, 197, 94, 0.25)',
                  color: '#86efac'
                } : {}),
                ...(updateStatus === 'available' ? {
                  background: 'rgba(59, 130, 246, 0.15)',
                  borderColor: 'rgba(59, 130, 246, 0.25)',
                  color: '#60a5fa'
                } : {})
              }}
            >
              {updateStatus === 'checking' && <RefreshCw size={16} className="spin" />}
              {updateStatus === 'idle' && (
                <>
                  <Download size={16} />
                  <span>Download Latest</span>
                </>
              )}
              {updateStatus === 'checking' && <span>Checking...</span>}
              {updateStatus === 'up-to-date' && <span>Up to Date ✓</span>}
              {updateStatus === 'available' && <span>Install & Restart</span>}
              {updateStatus === 'error' && <span>Check Failed</span>}
            </button>
          </div>

          {/* Timeline */}
          <div className="changelog-timeline">
            {CHANGELOG_DATA.map((version, index) => (
              <div key={version.version} className="changelog-version-block">
                {/* Version Header */}
                <div className="version-header">
                  <div className="version-timeline-marker">
                    <div className="timeline-dot" />
                    {index !== CHANGELOG_DATA.length - 1 && <div className="timeline-line" />}
                  </div>
                  <div className="version-info">
                    <div className="version-title-row">
                      <h3 className="version-number">{version.version}</h3>
                      {version.status === 'current' && (
                        <span className="version-badge current">Current</span>
                      )}
                      {version.status === 'release' && (
                        <span className="version-badge release">Initial Release</span>
                      )}
                    </div>
                    <p className="version-date">
                      <Clock size={14} />
                      {version.date}
                    </p>
                  </div>
                </div>

                {/* Features List */}
                <div className="version-features">
                  {version.features.map((feature, featureIndex) => (
                    <div key={featureIndex} className={`feature-item ${feature.type}`}>
                      <div className="feature-icon">{getFeatureIcon(feature.type)}</div>
                      <div className="feature-content">
                        <h4>{feature.title}</h4>
                        <p>{feature.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Future Updates Teaser */}
          <div className="changelog-future-section">
            <div className="future-card">
              <Sparkles size={24} className="future-icon" />
              <div className="future-content">
                <h4>Coming Soon</h4>
                <p>The next update will bring more AI models, improved upscaling, and an enhanced prompt library</p>
              </div>
              <ChevronRight size={20} className="future-arrow" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
