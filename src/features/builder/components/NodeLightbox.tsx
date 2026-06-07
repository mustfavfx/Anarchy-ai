import React from 'react';
import { X } from 'lucide-react';

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
  return (
    <div
      className={`node-lightbox ${lightbox === 'expand' ? 'node-lightbox--fullscreen' : ''}`}
      role="button"
      tabIndex={0}
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <img
        src={displayImage}
        alt={label}
        role="presentation"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        style={{
          maxWidth: lightbox === 'expand' ? '95vw' : '70vw',
          maxHeight: lightbox === 'expand' ? '95vh' : '70vh',
          objectFit: 'contain',
          borderRadius: '8px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
        }}
      />
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          background: 'rgba(255,255,255,0.1)',
          border: 'none',
          borderRadius: '50%',
          width: 32,
          height: 32,
          cursor: 'pointer',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
};
