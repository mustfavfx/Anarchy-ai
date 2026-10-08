import React, { useEffect } from 'react';
import { X, Download, ExternalLink, ZoomIn } from 'lucide-react';

interface ImageLightboxModalProps {
  imageUrl: string | null;
  title?: string;
  onClose: () => void;
}

export const ImageLightboxModal: React.FC<ImageLightboxModalProps> = ({
  imageUrl,
  title = 'Architectural Asset View',
  onClose,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!imageUrl) return null;

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `architectural_view_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <div className="lightbox-container" onClick={(e) => e.stopPropagation()}>
        <div className="lightbox-header">
          <div className="lightbox-title-wrap">
            <ZoomIn size={15} className="lightbox-icon" />
            <span className="lightbox-title">{title}</span>
          </div>
          <div className="lightbox-actions">
            <button
              type="button"
              className="lightbox-btn"
              onClick={handleDownload}
              title="Download image"
            >
              <Download size={14} />
              <span>Download</span>
            </button>
            <button
              type="button"
              className="lightbox-btn"
              onClick={() => window.open(imageUrl, '_blank')}
              title="Open in new tab"
            >
              <ExternalLink size={14} />
            </button>
            <button
              type="button"
              className="lightbox-close-btn"
              onClick={onClose}
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="lightbox-image-wrap">
          <img src={imageUrl} alt={title} className="lightbox-img" />
        </div>
      </div>
    </div>
  );
};
