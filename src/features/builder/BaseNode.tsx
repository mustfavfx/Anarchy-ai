import React, { memo, useRef, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { 
  FileInput, Wand2, X, Sun, Moon, Users, 
  Maximize, Palette, Scissors, RefreshCw, Loader2, AlertCircle, Download, Copyright,
  Eye, Maximize2, Copy
} from 'lucide-react';
import { pdfToImages } from '../../services/pdf/PdfService';
import { ExportModal } from '../../shared/components/ExportModal';
import { getLocalImageAsObjectURL, revokeObjectUrl } from '../../services/history/HistoryService';
import { NodeLightbox } from './components/NodeLightbox';
import { NodeUploadPlaceholder } from './components/NodeUploadPlaceholder';
import { useNotificationStore } from '../../stores/notificationStore';
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

  React.useEffect(() => {
    let active = true;
    let currentBlobUrl: string | undefined = undefined;

    if (!displayImageRaw) {
      setResolvedImageUrl(undefined);
      return;
    }

    const resolveImage = async () => {
      if (displayImageRaw.startsWith('idb://')) {
        const cachedUrl = await getLocalImageAsObjectURL(displayImageRaw);
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
  const isProcessing = nodeState === 'processing';
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
      setExportTarget({ url: imageUrl, name: `${nodeData.label || nodeData.type}_${Date.now()}` });
    }
  };

  const processFiles = async (files: File[]) => {
    if (!files.length) return;

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
      f => f.type.startsWith('image/') || f.type === 'application/pdf'
    );
    processFiles(files);
  };

  // Handle click on source/result node to spawn ghost node
  const handleNodeClick = () => {
    if ((isSource || isResult) && nodeData.image && nodeData.onAddChild) {
      // Spawn a ghost node with default processing type
      nodeData.onAddChild('render');
    }
  };


  const processingAnim = isProcessing ? 'processing-pulse' : '';
  const errorState = isError ? 'node-error' : '';
  const readyState = isReady ? 'node-ready' : '';
  


  return (
    <div 
      className={`
        anarchy-node 
        ${nodeType} 
        state-${nodeState}
        processing-${processingType} 
        ${selected ? 'selected' : ''} 
        ${displayImage ? 'has-content' : 'empty'}
        ${processingAnim}
        ${errorState}
        ${readyState}
      `}
      role="button"
      tabIndex={0}
      onClick={handleNodeClick}
      onKeyDown={(e) => { if (e.key === 'Enter') handleNodeClick(); }}
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
        <div className="node-body">
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
            >
              {displayImage ? (
                <>
                  <img
                    src={displayImage}
                    alt={nodeData.label}
                    loading="lazy"
                    decoding="async"
                    fetchPriority="low"
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      setImgDims({ w: img.naturalWidth, h: img.naturalHeight });
                    }}
                  />
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
                        onClick={(e) => { e.stopPropagation(); setLightbox('preview'); }}
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        type="button"
                        className="image-action-btn expand"
                        title="Full Screen"
                        onClick={(e) => { e.stopPropagation(); setLightbox('expand'); }}
                      >
                        <Maximize2 size={14} />
                      </button>
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
                  accept="image/*,application/pdf"
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
          label={nodeData.label}
          onClose={() => setLightbox(null)}
        />
      )}
      {isResult && nodeData.prompt && (
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
