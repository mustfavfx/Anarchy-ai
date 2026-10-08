import React from 'react';
import { Network, Image as ImageIcon, Sparkles, X } from 'lucide-react';
import './ImportWorkflowModal.css';

interface ImportWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportFullTree: () => void;
  onImportSingleImage: () => void;
  imagePreviewUrl?: string;
  isArabic?: boolean;
}

export const ImportWorkflowModal: React.FC<ImportWorkflowModalProps> = ({
  isOpen,
  onClose,
  onImportFullTree,
  onImportSingleImage,
  imagePreviewUrl,
  isArabic = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="import-workflow-overlay" onClick={onClose}>
      <div 
        className="import-workflow-modal" 
        onClick={(e) => e.stopPropagation()}
        style={{ direction: 'ltr' }}
      >
        {/* Header */}
        <div className="import-workflow-header">
          <div className="import-workflow-header-title">
            <div className="import-workflow-icon-badge">
              <Sparkles size={18} className="import-sparkle-icon" />
            </div>
            <div className="import-workflow-text">
              <span className="import-main-title">
                Workflow Graph Detected in File
              </span>
              <span className="import-sub-title">
                This image contains embedded workflow node tree metadata
              </span>
            </div>
          </div>
          <button className="import-close-btn" onClick={onClose} title="Close">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="import-workflow-body">
          {imagePreviewUrl && (
            <div className="import-preview-box">
              <img src={imagePreviewUrl} alt="Import Preview" className="import-preview-img" />
              <div className="import-preview-overlay-badge">
                <Network size={12} />
                <span>Workflow Image</span>
              </div>
            </div>
          )}

          <div className="import-options-grid">
            {/* Option 1: Full Node Tree */}
            <div className="import-option-card primary" onClick={onImportFullTree}>
              <div className="import-card-icon-badge primary">
                <Network size={22} />
              </div>
              <div className="import-card-content">
                <span className="import-card-title">
                  🌳 Restore Full Node Tree
                </span>
                <span className="import-card-desc">
                  Reconstruct the complete project graph with connected parent/child nodes on canvas
                </span>
              </div>
            </div>

            {/* Option 2: Standalone Image Only */}
            <div className="import-option-card secondary" onClick={onImportSingleImage}>
              <div className="import-card-icon-badge secondary">
                <ImageIcon size={22} />
              </div>
              <div className="import-card-content">
                <span className="import-card-title">
                  🖼️ Add Standalone Image Only
                </span>
                <span className="import-card-desc">
                  Add this image as a single independent source node without restoring node graph
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
