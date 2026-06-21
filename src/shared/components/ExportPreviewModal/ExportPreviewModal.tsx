/**
 * Export Preview Modal
 * Shows project thumbnail and export options before saving
 */

import React from 'react';
import { X, FileJson, Images, FileText } from 'lucide-react';
import './ExportPreviewModal.css';

export interface ExportPreviewModalProps {
  thumbnail?: string;
  projectName: string;
  nodeCount: number;
  edgeCount: number;
  onClose: () => void;
  onExport: (format: 'ana' | 'images' | 'pdf') => void;
}

export const ExportPreviewModal: React.FC<ExportPreviewModalProps> = ({
  thumbnail,
  projectName,
  nodeCount,
  edgeCount,
  onClose,
  onExport,
}) => {
  return (
    <div className="export-preview-overlay" onClick={onClose}>
      <div className="export-preview-modal" onClick={(e) => e.stopPropagation()}>
        <button className="preview-close-btn" onClick={onClose}>
          <X size={18} />
        </button>

        <h3 className="preview-title">Export Project</h3>
        <p className="preview-subtitle">{projectName}</p>

        {/* Thumbnail Preview */}
        <div className="preview-thumbnail-container">
          {thumbnail ? (
            <img 
              src={thumbnail} 
              alt="Project preview" 
              className="preview-thumbnail-img"
            />
          ) : (
            <div className="preview-thumbnail-placeholder">
              <Images size={48} />
              <span>No preview available</span>
            </div>
          )}
        </div>

        {/* Project Stats */}
        <div className="preview-stats">
          <div className="preview-stat">
            <span className="stat-value">{nodeCount}</span>
            <span className="stat-label">Nodes</span>
          </div>
          <div className="preview-stat">
            <span className="stat-value">{edgeCount}</span>
            <span className="stat-label">Connections</span>
          </div>
        </div>

        {/* Export Options */}
        <div className="preview-export-options">
          <button 
            className="preview-export-btn primary"
            onClick={() => onExport('ana')}
          >
            <FileJson size={20} />
            <div className="btn-content">
              <span className="btn-label">Save Project</span>
              <span className="btn-sublabel">.ana file with all data</span>
            </div>
          </button>

          <button 
            className="preview-export-btn"
            onClick={() => onExport('images')}
          >
            <Images size={20} />
            <div className="btn-content">
              <span className="btn-label">Export Images</span>
              <span className="btn-sublabel">All node images</span>
            </div>
          </button>

          <button 
            className="preview-export-btn"
            onClick={() => onExport('pdf')}
          >
            <FileText size={20} />
            <div className="btn-content">
              <span className="btn-label">Export PDF</span>
              <span className="btn-sublabel">Combined document</span>
            </div>
          </button>
        </div>

        <button className="preview-cancel-btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
};
