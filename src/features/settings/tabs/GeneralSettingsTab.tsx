import React from 'react';
import { Zap, Mail, Globe, Camera, MessageCircle } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import type { AppSettings } from '../../../services/settings';
import { APP_INFO } from '../../../config/appInfo';
import { WatermarkSettingsPanel } from './WatermarkSettingsPanel';

interface GeneralSettingsTabProps {
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  onOpenSupportModal: () => void;
}

export const GeneralSettingsTab: React.FC<GeneralSettingsTabProps> = ({
  settings,
  updateSetting,
  onOpenSupportModal,
}) => {
  return (
    <>
      {/* Watermark Card & Studio */}
      <WatermarkSettingsPanel />

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

      {/* Support & Community Card */}
      <div className="settings-card">
        <div className="settings-card-header">
          <Mail size={18} className="card-icon" />
          <h3>Support & Community</h3>
        </div>

        <div className="setting-item" style={{ borderBottom: 'none', paddingBottom: 0 }}>
          <div className="setting-item-content full-width">
            <span className="setting-desc" style={{ marginBottom: 16 }}>
              Get in touch with support, check our website, or join our official community channels.
            </span>
            
            <div className="support-links-grid-horizontal">
              <button
                className="support-link-card-btn"
                onClick={onOpenSupportModal}
              >
                <div className="support-icon-circle email">
                  <Mail size={16} />
                </div>
                <div className="support-card-text">
                  <strong>Email Support</strong>
                </div>
              </button>

              <button
                className="support-link-card-btn"
                onClick={() => invoke('open_url', { url: APP_INFO.links.website }).catch(() => {})}
              >
                <div className="support-icon-circle website">
                  <Globe size={16} />
                </div>
                <div className="support-card-text">
                  <strong>Official Website</strong>
                </div>
              </button>

              <button
                className="support-link-card-btn"
                onClick={() => invoke('open_url', { url: APP_INFO.links.instagram }).catch(() => {})}
              >
                <div className="support-icon-circle instagram">
                  <Camera size={16} />
                </div>
                <div className="support-card-text">
                  <strong>Instagram</strong>
                </div>
              </button>

              <button
                className="support-link-card-btn"
                onClick={() => invoke('open_url', { url: APP_INFO.links.telegram }).catch(() => {})}
              >
                <div className="support-icon-circle telegram">
                  <MessageCircle size={16} />
                </div>
                <div className="support-card-text">
                  <strong>Telegram Channel</strong>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
