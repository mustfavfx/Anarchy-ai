import React from 'react';
import { Layers, Sparkles, Scan } from 'lucide-react';

export interface LayoutGalleryViewProps {
  className?: string;
  availableImages: any[];
  onSelectImage: (url: string) => void;
}

export const LayoutGalleryView: React.FC<LayoutGalleryViewProps> = ({
  className = '',
  availableImages,
  onSelectImage,
}) => {
  return (
    <div className={`layout-editor-gallery-view anarchy-studio-theme ${className}`}>
      <div className="gallery-header">
        <div className="gallery-title-row">
          <Layers size={24} className="text-red" />
          <h2>Analyzed Scenes & Canvas Objects — Anarchy Analysis</h2>
        </div>
        <p className="gallery-subtitle">
          Select any previously analyzed scene or canvas image to extract and manage layout objects interactively.
        </p>
      </div>

      {availableImages.length === 0 ? (
        <div className="layout-editor-empty">
          <Layers size={40} className="empty-icon text-red" />
          <p style={{ marginTop: '12px', fontSize: '14px', color: '#94a3b8' }}>
            No analyzed scenes found yet. Create or select an image on the canvas to begin.
          </p>
        </div>
      ) : (
        <div className="analyzed-gallery-grid">
          {availableImages.map((item, idx) => (
            <div
              key={`${item.url.substring(0, 30)}-${idx}`}
              className="analyzed-gallery-card"
              onClick={() => onSelectImage(item.url)}
            >
              <div className="gallery-thumb-wrapper">
                <img
                  src={item.url}
                  alt={item.prompt || `Analyzed Scene ${idx + 1}`}
                  className="gallery-thumb-img"
                  onError={(e) => {
                    const card = (e.currentTarget as HTMLElement).closest('.analyzed-gallery-card');
                    if (card) (card as HTMLElement).style.display = 'none';
                  }}
                />
                <div className="gallery-card-badge">
                  {item.isAnalyzed ? (
                    <span className="badge-analyzed">
                      <Sparkles size={11} /> Anarchy Analysis
                    </span>
                  ) : (
                    <span className="badge-canvas">
                      <Layers size={11} /> Canvas Scene
                    </span>
                  )}
                </div>
                <div className="gallery-card-overlay">
                  <button type="button" className="analyze-card-btn">
                    <Scan size={14} />
                    <span>Extract Layout & Layers</span>
                  </button>
                </div>
              </div>
              <div className="gallery-card-footer">
                <span className="gallery-card-title">{item.prompt || `Scene #${idx + 1}`}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
