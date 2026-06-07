import React from 'react';
import {
  X, History, Sparkles, Zap, CheckCircle,
  Clock, ChevronRight, Download
} from 'lucide-react';
import './ChangelogModal.css';

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangelogModal: React.FC<ChangelogModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const versions = [
    {
      version: 'v0.07',
      date: 'May 2026',
      status: 'current',
      features: [
        {
          type: 'feature',
          icon: <Sparkles size={16} />,
          title: 'Crop Tool in Mask Canvas',
          description: 'Added a full crop tool with corner handles, rule-of-thirds grid, and keyboard shortcuts (C to activate, Enter to apply)'
        },
        {
          type: 'feature',
          icon: <Sparkles size={16} />,
          title: 'Expanded Mask View',
          description: 'Mask & Crop tools are now available in the fullscreen expanded view for a better editing experience'
        },
        {
          type: 'improvement',
          icon: <Zap size={16} />,
          title: 'History Now Updates Instantly',
          description: 'Fixed a bug where newly generated images did not appear in History until reopening the app'
        },
        {
          type: 'fix',
          icon: <CheckCircle size={16} />,
          title: 'Image Persistence in History',
          description: 'Input images are now saved locally before being recorded in history, preventing broken image links'
        }
      ]
    },
    {
      version: 'v0.06',
      date: 'April 2026',
      status: 'release',
      features: [
        {
          type: 'feature',
          icon: <Sparkles size={16} />,
          title: 'Node-Based Builder',
          description: 'Complete node-based workflow system for chaining AI generations, upscaling, and image editing'
        },
        {
          type: 'feature',
          icon: <Sparkles size={16} />,
          title: 'AI Image Generation',
          description: 'Multi-model AI rendering for architectural visualization with prompt control and reference images'
        },
        {
          type: 'feature',
          icon: <Sparkles size={16} />,
          title: 'History & Library',
          description: 'Full generation history with full-res image storage, starring, filtering, and node tree replay'
        },
        {
          type: 'feature',
          icon: <Sparkles size={16} />,
          title: 'Compare Mode',
          description: 'Side-by-side A/B comparison of generated images with a draggable slider'
        }
      ]
    }
  ];

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
              <span className="version-number">{versions[0].version}</span>
            </div>
            <a href="https://anarchy.lat/" target="_blank" rel="noopener noreferrer" className="download-latest-btn">
              <Download size={16} />
              Download Latest
            </a>
          </div>

          {/* Timeline */}
          <div className="changelog-timeline">
            {versions.map((version, index) => (
              <div key={version.version} className="changelog-version-block">
                {/* Version Header */}
                <div className="version-header">
                  <div className="version-timeline-marker">
                    <div className="timeline-dot" />
                    {index !== versions.length - 1 && <div className="timeline-line" />}
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
                      <div className="feature-icon">{feature.icon}</div>
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
                <p>v0.08 will bring more AI models, improved upscaling, and an enhanced prompt library</p>
              </div>
              <ChevronRight size={20} className="future-arrow" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
