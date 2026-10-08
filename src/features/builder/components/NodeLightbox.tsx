import React, { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { isVideoUrl } from '../utils/builderHelpers';
import { ImageEditorToolbar } from './ImageEditorToolbar';

interface NodeLightboxProps {
  lightbox: 'preview' | 'expand';
  displayImage: string;
  label?: string;
  isVideo?: boolean;
  nodeId?: string;
  prompt?: string;
  onImageUpdate?: (newImageUrl: string) => void;
  onClose: () => void;
}

export const NodeLightbox: React.FC<NodeLightboxProps> = ({
  lightbox,
  displayImage: initialDisplayImage,
  label,
  isVideo: isVideoProp,
  nodeId,
  prompt,
  onImageUpdate,
  onClose,
}) => {
  const [currentImage, setCurrentImage] = useState<string>(initialDisplayImage);
  useEffect(() => {
    setCurrentImage(initialDisplayImage);
  }, [initialDisplayImage]);

  const isVideo = isVideoProp !== undefined ? isVideoProp : isVideoUrl(currentImage);
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-play video when lightbox opens
  useEffect(() => {
    if (isVideo && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, [isVideo]);

  const maxW = lightbox === 'expand' ? '92vw' : '82vw';
  const maxH = lightbox === 'expand' ? '82vh' : '75vh';

  const handleInternalImageUpdate = (newUrl: string) => {
    setCurrentImage(newUrl);
    onImageUpdate?.(newUrl);
  };

  return createPortal(
    <div
      ref={containerRef}
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
        background: 'rgba(0,0,0,0.92)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
      }}
    >
      {/* Close button — top-right corner of the overlay */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        title="Close (Esc)"
        style={{
          position: 'fixed',
          top: 18,
          right: 20,
          zIndex: 10006,
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
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.28)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
      >
        <X size={18} />
      </button>

      {/* Media Wrapper */}
      <div
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          maxWidth: maxW,
          maxHeight: maxH,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {isVideo ? (
          <video
            ref={videoRef}
            src={currentImage}
            controls
            loop
            playsInline
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
          <>
            <img
              ref={imageRef}
              src={currentImage}
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

            {/* ChatGPT-style Floating Image Editor Toolbar */}
            <ImageEditorToolbar
              imageUrl={currentImage}
              imageElementRef={imageRef}
              containerRef={containerRef}
              nodeId={nodeId}
              prompt={prompt}
              onImageUpdate={handleInternalImageUpdate}
              onCloseLightbox={onClose}
            />
          </>
        )}
      </div>
    </div>,
    document.body
  );
};
