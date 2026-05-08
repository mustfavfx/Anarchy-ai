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
      version: 'v1.1.0',
      date: 'April 2026',
      status: 'current',
      features: [
        {
          type: 'feature',
          icon: <Sparkles size={16} />,
          title: 'AI-Powered Massing Node',
          description: 'Generate architectural massing concepts with AI-powered spatial analysis and automatic volume optimization'
        },
        {
          type: 'improvement',
          icon: <Zap size={16} />,
          title: '30% Faster Viewport Performance',
          description: 'Optimized rendering engine for smoother workflow with complex node graphs'
        },
        {
          type: 'fix',
          icon: <CheckCircle size={16} />,
          title: 'Fixed Node Connection Lag',
          description: 'Resolved latency issues when connecting multiple nodes in sequence'
        },
        {
          type: 'improvement',
          icon: <Zap size={16} />,
          title: 'Enhanced Export Formats',
          description: 'Added support for 3ds Max 2025 and Revit 2024 native file formats'
        }
      ]
    },
    {
      version: 'v1.0.0',
      date: 'March 2026',
      status: 'release',
      features: [
        {
          type: 'feature',
          icon: <Sparkles size={16} />,
          title: 'Initial Release',
          description: 'Complete node-based workflow system for architectural visualization'
        },
        {
          type: 'feature',
          icon: <Sparkles size={16} />,
          title: 'AI Image Generation',
          description: 'Integration with Replicate API for architectural rendering'
        },
        {
          type: 'feature',
          icon: <Sparkles size={16} />,
          title: 'Multi-Format Export',
          description: 'Export to 3ds Max, Revit, SketchUp, and Rhino'
        },
        {
          type: 'feature',
          icon: <Sparkles size={16} />,
          title: 'Dark Mode Interface',
          description: 'Professional dark UI optimized for long design sessions'
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
            <a href="#" className="download-latest-btn">
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
                <p>v1.2.0 will introduce VR viewport preview, collaborative workspaces, and advanced parametric nodes</p>
              </div>
              <ChevronRight size={20} className="future-arrow" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
