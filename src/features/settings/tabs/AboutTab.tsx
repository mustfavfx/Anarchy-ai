import React from 'react';
import { Info, RefreshCw, History, Shield } from 'lucide-react';
import { APP_INFO } from '../../../config/appInfo';

interface AboutTabProps {
  appVersion: string;
  updateStatus: 'idle' | 'checking' | 'available' | 'up-to-date' | 'error';
  onCheckForUpdates: () => void;
  onOpenChangelogModal: () => void;
  onOpenPrivacyModal: () => void;
}

export const AboutTab: React.FC<AboutTabProps> = ({
  appVersion,
  updateStatus,
  onCheckForUpdates,
  onOpenChangelogModal,
  onOpenPrivacyModal,
}) => {
  return (
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
            onClick={onCheckForUpdates}
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
          <button className="about-link-card" onClick={onOpenChangelogModal}>
            <History size={20} />
            Changelog
          </button>
          <button className="about-link-card" onClick={onOpenPrivacyModal}>
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
  );
};
