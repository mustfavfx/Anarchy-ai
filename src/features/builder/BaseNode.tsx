import React, { memo, useRef, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { 
  FileInput, Wand2, X, Sun, Moon, Users, 
  Maximize, Palette, Scissors, RefreshCw, Loader2, AlertCircle, Download, Copyright,
  Eye, Copy, Volume2, VolumeX, Play, Pause, Clapperboard, Sparkles
} from 'lucide-react';
import { pdfToImages } from '../../services/pdf/PdfService';
import { ExportModal } from '../../shared/components/ExportModal';
import { getLocalImageAsObjectURL, revokeObjectUrl } from '../../services/history/HistoryService';
import { anarchyService } from '../../services/anarchy/AnarchyService';
import { NodeLightbox } from './components/NodeLightbox';
import { NodeUploadPlaceholder } from './components/NodeUploadPlaceholder';
import { useNotificationStore } from '../../stores/notificationStore';
import { isVideoNode, isVideoUrl } from './utils/builderHelpers';
import { downloadImage } from '../../utils/imageExport';
import { useAIConfigStore } from '../../stores/aiConfigStore';
import './BaseNode.css';
import './BaseNode.glass.css';
import type { ProcessingType, BuilderNodeData } from './types';

interface BaseNodeProps extends NodeProps {
  data: BuilderNodeData;
}

// Processing type configuration (all use brand red for unified identity)
const PROCESSING_CONFIG: Record<ProcessingType, { icon: React.ReactNode; color: string; desc: string }> = {
  source: { icon: <FileInput size={12} />, color: '#e11d48', desc: 'Original input' },
  render: { icon: <Wand2 size={12} />, color: '#e11d48', desc: 'AI generation' },
  detail: { icon: <Maximize size={12} />, color: '#e11d48', desc: 'Detail enhancement' },
  upscale: { icon: <Maximize size={12} />, color: '#e11d48', desc: 'Resolution increase' },
  people: { icon: <Users size={12} />, color: '#e11d48', desc: 'Add/remove people' },
  daynight: { icon: <Moon size={12} />, color: '#e11d48', desc: 'Day to night' },
  lighting: { icon: <Sun size={12} />, color: '#e11d48', desc: 'Lighting adjust' },
  material: { icon: <Palette size={12} />, color: '#e11d48', desc: 'Material change' },
  local: { icon: <Scissors size={12} />, color: '#e11d48', desc: 'Local edit' },
  video: { icon: <Clapperboard size={12} />, color: '#e11d48', desc: 'Video generation' },
  variation: { icon: <RefreshCw size={12} />, color: '#e11d48', desc: 'Style variation' }
};


export const BaseNode = memo(({ data, selected }: BaseNodeProps) => {
  if (process.env.NODE_ENV === 'development' || (globalThis as any).__DEV__) {
    (globalThis as any).__anarchyNodeRenders = ((globalThis as any).__anarchyNodeRenders || 0) + 1;
  }
  const nodeData = data;
  const displayImageRaw = nodeData.image || nodeData.outputData?.image;
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string | undefined>(undefined);
  const [copied, setCopied] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [uploadedIsVideo, setUploadedIsVideo] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const addNotification = useNotificationStore((s) => s.addNotification);

  const handleCopyPrompt = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (nodeData.prompt) {
      navigator.clipboard.writeText(nodeData.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      addNotification({
        type: 'success',
        title: 'Prompt Copied',
        message: 'Prompt copied to clipboard successfully.',
        duration: 2000
      });
    }
  };

  const handleTogglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (video) {
      if (video.paused) {
        video.play().catch(() => {});
        setIsPaused(false);
      } else {
        video.pause();
        setIsPaused(true);
      }
    }
  };

  const [imgError, setImgError] = useState(false);

  React.useEffect(() => {
    setImgDims(null);
    setImgError(false);
    let active = true;
    let currentBlobUrl: string | undefined = undefined;

    if (!displayImageRaw) {
      setResolvedImageUrl(undefined);
      return;
    }

    const resolveImage = async () => {
      if (displayImageRaw.startsWith('idb://')) {
        if (process.env.NODE_ENV === 'development') {
          console.log('[BaseNode] resolving idb key:', displayImageRaw, 'isVideo:', isVideoNode(nodeData));
        }
        const cachedUrl = await getLocalImageAsObjectURL(displayImageRaw);
        if (process.env.NODE_ENV === 'development') {
          console.log('[BaseNode] resolved URL prefix:', cachedUrl?.substring(0, 60));
        }
        if (!active) {
          if (cachedUrl && cachedUrl.startsWith('blob:')) {
            URL.revokeObjectURL(cachedUrl);
          }
          return;
        }
        if (cachedUrl) {
          if (cachedUrl.startsWith('blob:')) {
            currentBlobUrl = cachedUrl;
          }
          setResolvedImageUrl(cachedUrl);
        } else {
          setResolvedImageUrl(undefined);
        }
        return;
      }

      if (!active) return;

      if (displayImageRaw.startsWith('data:')) {
        try {
          const response = await fetch(displayImageRaw);
          const blob = await response.blob();
          if (!active) return;
          const blobUrl = URL.createObjectURL(blob);
          currentBlobUrl = blobUrl;
          setResolvedImageUrl(blobUrl);
        } catch {
          if (active) setResolvedImageUrl(displayImageRaw);
        }
      } else {
        setResolvedImageUrl(displayImageRaw);
      }
    };

    resolveImage();

    return () => {
      active = false;
      if (currentBlobUrl) {
        revokeObjectUrl(currentBlobUrl);
      }
    };
  }, [displayImageRaw]);

  const displayImage = resolvedImageUrl;
  const nodeType = nodeData.type;
  const nodeState = nodeData.state || 'idle';
  
  // Determine node type flags (BaseNode only handles Source and Result nodes)
  const isSource = nodeType === 'source';
  const isResult = nodeType === 'result';
  
  // Determine state flags
  const isConnecting = nodeState === 'connecting';
  const isQueued = nodeState === 'queued';
  const isProcessing = nodeState === 'processing' || isConnecting || isQueued;
  const isReady = nodeState === 'ready' || nodeState === 'completed';
  const isError = nodeState === 'error' || nodeState === 'failed';
  const isCancelled = nodeState === 'cancelled';
  
  const processingType = nodeData.processingType || 'source';
  const config = PROCESSING_CONFIG[processingType] || PROCESSING_CONFIG.source;
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [exportTarget, setExportTarget] = useState<{ url: string; name: string } | null>(null);
  const [lightbox, setLightbox] = useState<'preview' | 'expand' | null>(null);
  const [imgDims, setImgDims] = useState<{ w: number; h: number } | null>(null);
  // FIX 6: Read enableWatermark from node data (set once in BuilderPage) instead
  // of subscribing to Zustand per-node. Avoids N separate store subscribers.
  const enableWatermark = nodeData.enableWatermark ?? false;

  const handleExportClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const imageUrl = displayImage;
    if (imageUrl) {
      const isVid = isVideoNode(nodeData) || uploadedIsVideo || isVideoUrl(imageUrl);
      if (isVid) {
        downloadImage(imageUrl, `${nodeData.label || nodeData.type || 'video'}_${Date.now()}`, { isVideo: true });
      } else {
        setExportTarget({ url: imageUrl, name: `${nodeData.label || nodeData.type}_${Date.now()}` });
      }
    }
  };

  const processFiles = async (files: File[]) => {
    if (!files.length) return;

    // Handle video files — read as data URL so it works with CSP + isVideoUrl
    const videos = files.filter(f => f.type.startsWith('video/'));
    if (videos.length > 0) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string; // data:video/mp4;base64,...
        setUploadedIsVideo(true);
        nodeData.onImageUpload?.(dataUrl);
      };
      reader.readAsDataURL(videos[0]);
      return;
    }

    // Separate PDFs from images
    const pdfs = files.filter(f => f.type === 'application/pdf');
    const images = files.filter(f => f.type.startsWith('image/'));

    const imageUrls: string[] = await Promise.all(
      images.map(file => new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      }))
    );

    // Convert each PDF page to image
    if (pdfs.length > 0) {
      setIsPdfLoading(true);
      try {
        for (const pdf of pdfs) {
          const pages = await pdfToImages(pdf, 2);
          pages.forEach(p => imageUrls.push(p.dataUrl));
        }
      } finally {
        setIsPdfLoading(false);
      }
    }

    if (!imageUrls.length) return;

    if (imageUrls.length > 1 && nodeData.onImagesUpload) {
      nodeData.onImagesUpload(imageUrls);
    } else {
      nodeData.onImageUpload?.(imageUrls[0]);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    processFiles(files);
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!isSource) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!isSource) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(
      f => f.type.startsWith('image/') || f.type.startsWith('video/') || f.type === 'application/pdf'
    );
    processFiles(files);
  };

  const studioMode = useAIConfigStore((s) => s.config.studioMode || 'edit');

  // Handle click on source/result node to spawn ghost node (Edit mode only)
  const handleNodeClick = () => {
    if (studioMode === 'generate') return; // Do not spawn ghost node in Generate mode
    if ((isSource || isResult) && nodeData.image && nodeData.onAddChild) {
      // Spawn a ghost node with default processing type
      nodeData.onAddChild('render');
    }
  };


  const processingAnim = isProcessing ? 'processing-pulse' : '';
  const errorState = isError ? 'node-error' : '';
  const readyState = isReady ? 'node-ready' : '';
  

  const isAnalyzed = React.useMemo(() => {
    if (nodeData.extractedLayout || nodeData.layout) return true;
    if (!displayImageRaw) return false;
    try {
      const key = anarchyService.getCacheKey(displayImageRaw);
      if (anarchyService.layoutCache.has(key)) return true;
      if (localStorage.getItem(`anarchy_layout_${key}`)) return true;
    } catch {}
    return false;
  }, [nodeData.extractedLayout, nodeData.layout, displayImageRaw]);

  return (
    <div 
      className={`
        anarchy-node 
        type-${nodeType} 
        state-${nodeState}
        processing-${processingType} 
        ${selected ? 'selected' : ''} 
        ${displayImage ? 'has-content' : 'empty'}
        ${processingAnim}
        ${errorState}
        ${readyState}
        ${isAnalyzed ? 'node-is-analyzed' : ''}
      `}
      role="button"
      tabIndex={0}
      onClick={handleNodeClick}
    >
      <div className="node-selection-ring" />
      <div className="node-accent-strip" style={{ background: `linear-gradient(180deg, transparent, ${config.color}, transparent)` }} />
      {selected && <div className="node-selected-glow" style={{ background: `radial-gradient(circle at center, ${config.color}15 0%, transparent 70%)` }} />}
      
      {/* Target handle only for non-source nodes (Result nodes can receive connections) */}
      {!isSource && (
        <Handle type="target" position={Position.Left} id="target" className="anarchy-handle" />
      )}
      
      <div className="node-wrapper">
        <div className="node-gloss" />
        <div className="node-inner-shadow" />
        
        {/* Header Section */}
        <div className="node-header">
          <div className="node-identity">
            <div className="node-title-group">
              <span className="node-type-label">{nodeData.label}</span>
              {isAnalyzed && (
                <span className="node-status-badge analyzed" title="Scene Analyzed — Layout & Objects Extracted">
                  <Sparkles size={10} />
                  Analyzed
                </span>
              )}
              {isProcessing && (
                <span className="node-status-badge processing">
                  <Loader2 size={10} className="spin" />
                  Processing...
                </span>
              )}
              {isError && (
                <span className="node-status-badge error">
                  <AlertCircle size={10} />
                  Error
                </span>
              )}
              {isCancelled && (
                <span className="node-status-badge cancelled">
                  <X size={10} />
                  Cancelled
                </span>
              )}
            </div>
          </div>
          <div className="node-actions">
            {displayImage && (
              <button
                type="button"
                className="node-action-btn download"
                onClick={handleExportClick}
                title="Export Image"
              >
                <Download size={12} />
              </button>
            )}
            {!isSource && nodeData.onDelete && (
              <button type="button" className="node-action-btn delete" onClick={(e) => { e.stopPropagation(); nodeData.onDelete?.(); }} title="Delete">
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Content Section */}
        <div className="node-body" style={{ position: 'relative' }}>
          {/* Processing/Connecting Overlay */}
          {(isProcessing || isConnecting || isQueued) && (
            <div className="ghost-processing-overlay" style={{ position: 'absolute', inset: 0, zIndex: 20, background: 'rgba(15, 15, 20, 0.94)', borderRadius: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Loader2 size={24} className="spin" style={{ color: '#e11d48' }} />
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#f43f5e' }}>
                {isConnecting 
                  ? 'Connecting to Model...' 
                  : isQueued 
                    ? 'Queued...' 
                    : 'Generating...'}
              </span>
              {(isQueued || isProcessing) && (
                <span className="ghost-status-badge">
                  {isQueued ? 'queued' : 'processing'}
                </span>
              )}
              {nodeData.onCancel && (
                <button 
                  type="button"
                  className="ghost-cancel-btn" 
                  onClick={(e) => {
                    e.stopPropagation();
                    nodeData.onCancel?.();
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          )}

          {/* Image Display (Source and Result nodes) */}
          {(isSource || isResult) && (
            <div 
              className={`node-image-region ${isSource && !displayImage ? 'upload-target' : ''} ${displayImage ? 'has-image' : ''} ${isDragOver ? 'drag-over' : ''}`}
              role={isSource && !displayImage ? 'button' : undefined}
              tabIndex={isSource && !displayImage ? 0 : undefined}
              onClick={() => isSource && !displayImage && fileInputRef.current?.click()}
              onKeyDown={(e) => isSource && !displayImage && e.key === 'Enter' && fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              style={imgDims ? { aspectRatio: `${imgDims.w} / ${imgDims.h}` } : undefined}
            >
              {displayImage ? (
                <>
                  {(isVideoNode(nodeData) || uploadedIsVideo) ? (
                    <video
                      ref={videoRef}
                      src={displayImage}
                      autoPlay
                      loop
                      muted={isMuted}
                      playsInline
                      className="nodrag"
                      onClick={handleTogglePlay}
                      onPlay={() => setIsPaused(false)}
                      onPause={() => setIsPaused(true)}
                      onLoadedMetadata={(e) => {
                        const vid = e.currentTarget;
                        setImgDims({ w: vid.videoWidth, h: vid.videoHeight });
                      }}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer' }}
                    />
                  ) : imgError ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '24px 12px', background: 'rgba(225, 29, 72, 0.08)', borderRadius: '6px', textAlign: 'center', width: '100%', height: '100%' }}>
                      <AlertCircle size={22} style={{ color: '#e11d48' }} />
                      <span style={{ fontSize: '11px', color: '#f8fafc', fontWeight: 600 }}>تعذر تحميل الصورة</span>
                      <button
                        type="button"
                        style={{ fontSize: '10px', background: '#e11d48', color: '#fff', border: 'none', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setImgError(false);
                          if (displayImageRaw?.startsWith('idb://')) {
                            getLocalImageAsObjectURL(displayImageRaw).then((u) => setResolvedImageUrl(u || undefined));
                          }
                        }}
                      >
                        <RefreshCw size={10} />
                        إعادة محاولة
                      </button>
                    </div>
                  ) : (
                    <img
                      src={displayImage}
                      alt={nodeData.label || 'صورة النود'}
                      loading="lazy"
                      decoding="async"
                      fetchPriority="low"
                      onLoad={(e) => {
                        const img = e.currentTarget;
                        setImgDims({ w: img.naturalWidth, h: img.naturalHeight });
                      }}
                      onError={() => setImgError(true)}
                    />
                  )}
                  {imgDims && (
                    <div className="image-res-badge">{imgDims.w}×{imgDims.h}</div>
                  )}
                  {/* Watermark indicator for result nodes */}
                  {isResult && enableWatermark && (
                    <div className="watermark-badge" title="Watermarked">
                      <Copyright size={10} />
                    </div>
                  )}
                  <div className="image-overlay">
                    <div className="image-actions">
                      <button
                        type="button"
                        className="image-action-btn preview"
                        title="Preview"
                        onClick={(e) => { e.stopPropagation(); setLightbox('expand'); }}
                      >
                        <Eye size={14} />
                      </button>
                      {(isVideoNode(nodeData) || uploadedIsVideo) && (
                        <button
                          type="button"
                          className="image-action-btn play-pause"
                          title={isPaused ? "Play" : "Pause"}
                          onClick={handleTogglePlay}
                        >
                          {isPaused ? <Play size={14} fill="currentColor" /> : <Pause size={14} fill="currentColor" />}
                        </button>
                      )}
                      {(isVideoNode(nodeData) || uploadedIsVideo) && (
                        <button
                          type="button"
                          className="image-action-btn volume"
                          title={isMuted ? "Unmute" : "Mute"}
                          onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
                        >
                          {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                        </button>
                      )}
                      {isSource && (
                        <button 
                          type="button"
                          className="image-action-btn remove" 
                          title="Remove"
                          onClick={(e) => { e.stopPropagation(); nodeData.onImageUpload?.(''); }}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <NodeUploadPlaceholder
                  isSource={isSource}
                  isPdfLoading={isPdfLoading}
                />
              )}
              {isSource && (
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*,application/pdf"
                  multiple
                  onChange={handleImageUpload}
                  style={{ display: 'none' }}
                />
              )}
            </div>
          )}

        </div>
      </div>

      <Handle 
        type="source" 
        position={Position.Right} 
        id="source" 
        className="anarchy-handle"
        style={{
          right: '-5px',
          left: 'auto',
          top: '50%',
          bottom: 'auto',
          transform: 'translateY(-50%)',
        }}
      />

      {/* Export Modal */}
      {exportTarget && (
        <ExportModal
          imageUrl={exportTarget.url}
          imageName={exportTarget.name}
          onClose={() => setExportTarget(null)}
        />
      )}

      {/* Lightbox */}
      {lightbox && displayImage && (
        <NodeLightbox
          lightbox={lightbox}
          displayImage={displayImage}
          isVideo={isVideoNode(nodeData) || uploadedIsVideo}
          label={nodeData.label}
          onClose={() => setLightbox(null)}
        />
      )}
      {nodeData.prompt && (
        <div
          className="node-prompt-bar"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="node-prompt-content-wrap">
            <button
              type="button"
              className={`node-prompt-copy-btn ${copied ? 'copied' : ''}`}
              onClick={handleCopyPrompt}
              title={copied ? "Copied!" : "Copy Prompt"}
            >
              <Copy size={10} />
            </button>
            <span
              className="node-prompt-text"
              style={{ userSelect: 'text', cursor: 'text' }}
              title={String(nodeData.prompt)}
            >
              {nodeData.prompt.length > 80 ? nodeData.prompt.slice(0, 80) + '...' : nodeData.prompt}
            </span>
          </div>
        </div>
      )}
    </div>
  );
});
