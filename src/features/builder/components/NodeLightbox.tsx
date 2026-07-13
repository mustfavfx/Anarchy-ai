import React, { useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { isVideoUrl } from '../utils/builderHelpers';

interface NodeLightboxProps {
  lightbox: 'preview' | 'expand';
  displayImage: string;
  label?: string;
  onClose: () => void;
}

export const NodeLightbox: React.FC<NodeLightboxProps> = ({
  lightbox,
  displayImage,
  label,
  onClose,
}) => {
  const isVideo = isVideoUrl(displayImage);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Auto-play video when lightbox opens
  useEffect(() => {
    if (isVideo && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, [isVideo]);

  const maxW = lightbox === 'expand' ? '92vw' : '78vw';
  const maxH = lightbox === 'expand' ? '90vh' : '78vh';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label ?? 'Media preview'}
      tabIndex={-1}
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.88)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Close button — top-right corner of the overlay, not the media */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        title="Close (Esc)"
        style={{
          position: 'fixed',
          top: 16,
          right: 16,
          zIndex: 10000,
          background: 'rgba(255,255,255,0.15)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.25)',
          borderRadius: '50%',
          width: 38,
          height: 38,
          cursor: 'pointer',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.28)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
      >
        <X size={18} />
      </button>

      {isVideo ? (
        <video
          ref={videoRef}
          src={displayImage}
          controls
          loop
          playsInline
          // Stop backdrop click propagation so clicking on video doesn't close
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          style={{
            maxWidth: maxW,
            maxHeight: maxH,
            width: 'auto',
            height: 'auto',
            objectFit: 'contain',
            borderRadius: '10px',
            boxShadow: '0 12px 60px rgba(0,0,0,0.7)',
            display: 'block',
          }}
        />
      ) : (
        <img
          src={displayImage}
          alt={label ?? 'Preview'}
          role="presentation"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          style={{
            maxWidth: maxW,
            maxHeight: maxH,
            width: 'auto',
            height: 'auto',
            objectFit: 'contain',
            borderRadius: '10px',
            boxShadow: '0 12px 60px rgba(0,0,0,0.7)',
            display: 'block',
          }}
        />
      )}
    </div>
  );
};
