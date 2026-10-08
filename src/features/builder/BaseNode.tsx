import React, { memo, useRef, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { 
  X, RefreshCw, AlertCircle, Copyright,
  Eye, Volume2, VolumeX, Play, Pause, Paintbrush2, Loader2
} from 'lucide-react';
import { pdfToImages } from '../../services/pdf/PdfService';
import { ExportModal } from '../../shared/components/ExportModal';
import { getLocalImageAsObjectURL, getLocalImage, cacheLocalImage } from '../../services/history/HistoryService';
import { anarchyService } from '../../services/anarchy/AnarchyService';
import { NodeLightbox } from './components/NodeLightbox';
import { NodeUploadPlaceholder } from './components/NodeUploadPlaceholder';
import { useNotificationStore } from '../../stores/notificationStore';
import { isVideoNode, isVideoUrl } from './utils/builderHelpers';
import { resolveCanvasThumbnail, invalidateCanvasThumbnail, getCachedCanvasThumbnail, primeCanvasThumbnail } from './utils/canvasImageOptimizer';
import { canvasSuperResolution } from '../../services/upscalers/MidjourneyTurboUpscaler';
import { downloadImage } from '../../utils/imageExport';
import { useAIConfigStore } from '../../stores/aiConfigStore';
import { canvasBridge } from '../../services/agent/CanvasBridgeService';
import './BaseNode.css';
import './BaseNode.glass.css';
import type { BuilderNodeData } from './types';

import { BaseNodeHeader } from './components/node/BaseNodeHeader';
import { BaseNodePromptBar } from './components/node/BaseNodePromptBar';
import { PROCESSING_CONFIG } from './components/node/nodeConstants';

interface BaseNodeProps extends NodeProps {
  data: BuilderNodeData;
}

export const BaseNode = memo(({ id, data, selected = false }: BaseNodeProps) => {
  const nodeData = data;
  const nodeDataRef = useRef(nodeData);
  nodeDataRef.current = nodeData;
  const classifiedKeyRef = useRef<string | null>(null);
  const fullImageRaw = nodeData.image || nodeData.outputData?.image;
  const displayImageRaw = nodeData.thumbnail || nodeData.outputData?.thumbnail || fullImageRaw;
  const targetKey = displayImageRaw || fullImageRaw;
  const initialSyncImage = targetKey
    ? (getCachedCanvasThumbnail(targetKey) || (targetKey.startsWith('data:') || targetKey.startsWith('blob:') ? targetKey : undefined))
    : undefined;
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string | undefined>(initialSyncImage);
  const [fullResolvedUrl, setFullResolvedUrl] = useState<string | undefined>(undefined);
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

  // Sync dimensions from node data when available
  const outputW = nodeData.outputData?.dimensions?.width;
  const outputH = nodeData.outputData?.dimensions?.height;
  const nodeW = nodeData.dimensions?.width;
  const nodeH = nodeData.dimensions?.height;

  React.useEffect(() => {
    const w = outputW ?? nodeW;
    const h = outputH ?? nodeH;
    if (w && h) {
      setImgDims(prev => (prev?.w === w && prev?.h === h ? prev : { w, h }));
    } else {
      setImgDims(prev => (prev === null ? null : null));
    }
  }, [outputW, outputH, nodeW, nodeH]);

  React.useEffect(() => {
    setImgError(false);
    let active = true;

    const targetKey = displayImageRaw || fullImageRaw;

    if (!targetKey) {
      setResolvedImageUrl(undefined);
      setFullResolvedUrl(undefined);
      return;
    }

    const syncCached = getCachedCanvasThumbnail(targetKey);
    if (syncCached) {
      setResolvedImageUrl(syncCached);
    }

    const resolveImage = async () => {
      // For videos, resolve directly without thumbnailing
      if (isVideoNode(nodeDataRef.current) || isVideoUrl(targetKey)) {
        if (targetKey.startsWith('idb://')) {
          const cachedUrl = await getLocalImageAsObjectURL(targetKey);
          if (!active) return;
          setResolvedImageUrl(cachedUrl || undefined);
        } else {
          setResolvedImageUrl(targetKey);
        }
        return;
      }

      // For images, resolve fast GPU-optimized canvas thumbnail (640px max)
      try {
        let thumbUrl = await resolveCanvasThumbnail(targetKey, 640);
        
        // If thumbUrl is empty or still 'idb://', fall back to fullImageRaw or targetKey
        if (!thumbUrl || thumbUrl.startsWith('idb://')) {
          const fallbackSource = fullImageRaw || targetKey;
          if (fallbackSource.startsWith('idb://')) {
            const b64 = await getLocalImage(fallbackSource);
            if (b64) {
              thumbUrl = b64;
            } else {
              thumbUrl = (await getLocalImageAsObjectURL(fallbackSource)) || '';
            }
          } else {
            thumbUrl = fallbackSource;
          }
        }

        // AUTO-HEAL: If image key is missing from IndexedDB (e.g. from prior aborted transaction),
        // automatically restore it from inputData.image or parent node's image in the lineage!
        if (!thumbUrl || thumbUrl.startsWith('idb://')) {
          const currentData = nodeDataRef.current;
          const parentKey: string | null = (currentData.inputData?.image as string) ||
            (currentData.lineage?.parentId 
              ? ((useAIConfigStore.getState().workflowSnapshot?.nodes || []).find((n: any) => n.id === currentData.lineage?.parentId)?.data as any)?.image || null
              : null);

          if (parentKey && parentKey !== targetKey) {
            let parentUrl = await getLocalImageAsObjectURL(parentKey);
            if (!parentUrl) {
              const b64 = await getLocalImage(parentKey);
              if (b64) parentUrl = b64;
            }

            if (parentUrl && !parentUrl.startsWith('idb://')) {
              try {
                const targetW = currentData.dimensions?.width || currentData.outputData?.dimensions?.width || 2048;
                const targetH = currentData.dimensions?.height || currentData.outputData?.dimensions?.height || 2048;
                const healed = await canvasSuperResolution(parentUrl, 2, { width: targetW, height: targetH });
                if (healed && healed.imageUrl) {
                  thumbUrl = healed.imageUrl;
                  await cacheLocalImage(targetKey, healed.imageUrl).catch(() => {});
                  if (fullImageRaw && fullImageRaw !== targetKey) {
                    await cacheLocalImage(fullImageRaw, healed.imageUrl).catch(() => {});
                  }
                  primeCanvasThumbnail(targetKey, healed.imageUrl);
                  if (fullImageRaw) primeCanvasThumbnail(fullImageRaw, healed.imageUrl);
                }
              } catch (healErr) {
                console.warn('[BaseNode] Auto-heal resolution error:', healErr);
                thumbUrl = parentUrl;
              }
            }
          }
        }

        // If thumbUrl is a remote URL that needs bypass (e.g. CometAPI, Midjourney, or Discord CDN), convert via Tauri url_to_base64
        const needsRemoteBypass = thumbUrl &&
          (thumbUrl.startsWith('http://') || thumbUrl.startsWith('https://')) &&
          (thumbUrl.includes('api.cometapi.com') ||
           thumbUrl.includes('midjourney') ||
           thumbUrl.includes('discordapp.com') ||
           thumbUrl.includes('discordapp.net'));

        if (needsRemoteBypass) {
          try {
            const { invoke } = await import('@tauri-apps/api/core');
            const b64 = await invoke<string>('url_to_base64', { url: thumbUrl });
            if (b64 && b64.startsWith('data:')) {
              thumbUrl = b64;
            }
          } catch {}
        }

        if (!active) return;

        if (thumbUrl && !thumbUrl.startsWith('idb://')) {
          setResolvedImageUrl(thumbUrl);
          setImgError(false);
        } else {
          setResolvedImageUrl(undefined);
          setImgError(true);
        }
      } catch {
        if (!active) return;
        const fallbackSource = fullImageRaw || targetKey;
        if (fallbackSource.startsWith('idb://')) {
          let cachedUrl = await getLocalImageAsObjectURL(fallbackSource);
          if (!cachedUrl) {
            cachedUrl = await getLocalImage(fallbackSource);
          }
          if (!active) return;
          if (cachedUrl && !cachedUrl.startsWith('idb://')) {
            setResolvedImageUrl(cachedUrl);
            setImgError(false);
          } else {
            setResolvedImageUrl(undefined);
            setImgError(true);
          }
        } else if (fallbackSource && !fallbackSource.startsWith('idb://')) {
          setResolvedImageUrl(fallbackSource);
          setImgError(false);
        } else {
          setResolvedImageUrl(undefined);
          setImgError(true);
        }
      }
    };

    resolveImage();

    return () => {
      active = false;
      // Do not revoke thumbnail blob URLs; memoryThumbnailCache manages its own lifecycle
    };
  }, [displayImageRaw, fullImageRaw]);

  // Auto-classify node image with ArchVision AI Agent when image is present
  React.useEffect(() => {
    const currentData = nodeDataRef.current;
    const isGenericDefault = currentData.semantic && (
      currentData.semantic.label === 'Architectural Asset' ||
      currentData.semantic.category === 'unknown' ||
      currentData.semantic.subTypology === 'Contemporary Residential Villa' ||
      currentData.semantic.subTypology === 'Architectural Asset'
    );
    // Automatically re-evaluate tags from earlier heuristic runs with the Gemini Multimodal Vision Engine
    const VISION_SCHEMA_EPOCH = 1790199000000;
    const isStale = currentData.semantic && (!currentData.semantic.analyzedAt || currentData.semantic.analyzedAt < VISION_SCHEMA_EPOCH);
    const shouldClassify = !currentData.semantic || isGenericDefault || isStale;

    if (!targetKey || !shouldClassify || isVideoNode(currentData) || isVideoUrl(targetKey)) {
      return;
    }

    // Guard against repeated classification runs for the same image
    if (classifiedKeyRef.current === targetKey) {
      return;
    }

    classifiedKeyRef.current = targetKey;
    const visionImageKey = fullImageRaw || targetKey;

    const timer = setTimeout(() => {
      canvasBridge.classifyCanvasNode(id, false, visionImageKey, nodeDataRef.current.prompt).catch((err) => {
        console.debug('[BaseNode] Semantic classification deferred:', err);
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [id, targetKey, fullImageRaw]);

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
  const [imgDims, setImgDims] = useState<{ w: number; h: number } | null>(() => {
    const d = (nodeData.outputData?.dimensions ?? nodeData.dimensions) as { width: number; height: number } | undefined;
    return d && d.width && d.height ? { w: d.width, h: d.height } : null;
  });
  // FIX 6: Read enableWatermark from node data (set once in BuilderPage) instead
  // of subscribing to Zustand per-node. Avoids N separate store subscribers.
  const enableWatermark = nodeData.enableWatermark ?? false;

  const handleExportClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    let imageUrl = fullResolvedUrl;
    if (!imageUrl && fullImageRaw) {
      if (fullImageRaw.startsWith('idb://')) {
        imageUrl = (await getLocalImageAsObjectURL(fullImageRaw)) || displayImage;
      } else {
        imageUrl = fullImageRaw;
      }
      if (imageUrl) setFullResolvedUrl(imageUrl);
    }
    if (!imageUrl) imageUrl = displayImage;

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

  // Handle click on source/result node to spawn ghost node (Edit and Upscale mode)
  const handleNodeClick = () => {
    const { config } = useAIConfigStore.getState();
    const studioMode = config.studioMode || 'edit';
    const selectedTool = config.selectedTool || 'image-editor';
    if (selectedTool === 'image-editor' && studioMode === 'generate') return; // Do not spawn ghost node in Generate mode
    if ((isSource || isResult) && nodeData.image && nodeData.onAddChild) {
      // Spawn a ghost node with appropriate processing type
      const processingType = selectedTool === 'image-upscaler' ? 'upscale' : (selectedTool === 'video-creator' ? 'video' : 'render');
      nodeData.onAddChild(processingType);
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
        <Handle
          type="target"
          position={Position.Left}
          id="target"
          className="anarchy-handle"
          style={{
            left: '-12px',
            right: 'auto',
            top: '50%',
            bottom: 'auto',
            transform: 'translateY(-50%)',
          }}
        />
      )}
      
      <div className="node-wrapper">
        <div className="node-gloss" />
        <div className="node-inner-shadow" />
        
        {/* Header Section */}
        <BaseNodeHeader
          id={id}
          nodeData={nodeData}
          displayImage={displayImage}
          fullImageRaw={fullImageRaw}
          targetKey={targetKey}
          isSource={isSource}
          isAnalyzed={isAnalyzed}
          isProcessing={isProcessing}
          isError={isError}
          isCancelled={isCancelled}
          onExportClick={handleExportClick}
        />

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
              style={
                displayImage && !displayImage.startsWith('idb://')
                  ? { minHeight: 'unset', ...(imgDims ? { aspectRatio: `${imgDims.w} / ${imgDims.h}` } : {}) }
                  : undefined
              }
            >
              {displayImage && !displayImage.startsWith('idb://') ? (
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
                      style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '4px', cursor: 'pointer' }}
                    />
                  ) : imgError ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '24px 12px', background: 'rgba(225, 29, 72, 0.08)', borderRadius: '6px', textAlign: 'center', width: '100%', height: '100%' }}>
                      <AlertCircle size={22} style={{ color: '#e11d48' }} />
                      <span style={{ fontSize: '11px', color: '#f8fafc', fontWeight: 600 }}>Failed to load image</span>
                      <button
                        type="button"
                        style={{ fontSize: '10px', background: '#e11d48', color: '#fff', border: 'none', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                        onClick={async (e) => {
                          e.stopPropagation();
                          setImgError(false);
                          if (displayImageRaw) invalidateCanvasThumbnail(displayImageRaw);
                          if (fullImageRaw) invalidateCanvasThumbnail(fullImageRaw);
                          const key = fullImageRaw || displayImageRaw || targetKey;
                          if (key) {
                            let u: string | null = null;
                            if (key.startsWith('idb://')) {
                              u = await getLocalImageAsObjectURL(key);
                              if (!u) u = await getLocalImage(key);
                            } else {
                              u = key;
                            }
                            if (u && !u.startsWith('idb://')) {
                              setResolvedImageUrl(u);
                              return;
                            }
                            // Auto-heal on retry if image missing from IDB
                            const parentKey: string | null = (nodeDataRef.current.inputData?.image as string) ||
                              (nodeDataRef.current.lineage?.parentId 
                                ? ((useAIConfigStore.getState().workflowSnapshot?.nodes || []).find((n: any) => n.id === nodeDataRef.current.lineage?.parentId)?.data as any)?.image || null
                                : null);
                            if (parentKey) {
                              let parentUrl = await getLocalImageAsObjectURL(parentKey);
                              if (!parentUrl) parentUrl = await getLocalImage(parentKey);
                              if (parentUrl && !parentUrl.startsWith('idb://')) {
                                try {
                                  const targetW = nodeDataRef.current.dimensions?.width || 2048;
                                  const targetH = nodeDataRef.current.dimensions?.height || 2048;
                                  const healed = await canvasSuperResolution(parentUrl, 2, { width: targetW, height: targetH });
                                  if (healed && healed.imageUrl) {
                                    await cacheLocalImage(key, healed.imageUrl).catch(() => {});
                                    primeCanvasThumbnail(key, healed.imageUrl);
                                    setResolvedImageUrl(healed.imageUrl);
                                    setImgError(false);
                                    return;
                                  }
                                } catch {}
                              }
                            }
                            setImgError(true);
                          }
                        }}
                      >
                        <RefreshCw size={10} />
                        Retry
                      </button>
                    </div>
                  ) : (
                    <img
                      src={displayImage}
                      alt={nodeData.label || 'Node image'}
                      referrerPolicy="no-referrer"
                      onLoad={(e) => {
                        const img = e.currentTarget;
                        if (!nodeData.dimensions && !nodeData.outputData?.dimensions) {
                          setImgDims({ w: img.naturalWidth, h: img.naturalHeight });
                          nodeData.dimensions = { width: img.naturalWidth, height: img.naturalHeight };
                          if (nodeData.outputData) {
                            nodeData.outputData.dimensions = { width: img.naturalWidth, height: img.naturalHeight };
                          }
                        }
                      }}
                      onError={async () => {
                        // 1. If displayImage or fallbackKey is in IndexedDB, fetch base64 data URI directly (100% reliable)
                        const fallbackKey = fullImageRaw || displayImageRaw || targetKey;
                        if (fallbackKey && fallbackKey.startsWith('idb://')) {
                          try {
                            const b64 = await getLocalImage(fallbackKey);
                            if (b64 && (b64.startsWith('data:') || b64.startsWith('blob:'))) {
                              setResolvedImageUrl(b64);
                              setImgError(false);
                              return;
                            }
                            const objUrl = await getLocalImageAsObjectURL(fallbackKey);
                            if (objUrl && !objUrl.startsWith('idb://')) {
                              setResolvedImageUrl(objUrl);
                              setImgError(false);
                              return;
                            }
                          } catch {}
                        }

                        // 2. Auto-heal: If node image missing, restore from parent source
                        const parentKey: string | null = (nodeDataRef.current.inputData?.image as string) ||
                          (nodeDataRef.current.lineage?.parentId 
                            ? ((useAIConfigStore.getState().workflowSnapshot?.nodes || []).find((n: any) => n.id === nodeDataRef.current.lineage?.parentId)?.data as any)?.image || null
                            : null);
                        if (parentKey && parentKey !== targetKey) {
                          try {
                            let parentUrl = await getLocalImageAsObjectURL(parentKey);
                            if (!parentUrl) parentUrl = await getLocalImage(parentKey);
                            if (parentUrl && !parentUrl.startsWith('idb://')) {
                              const targetW = nodeDataRef.current.dimensions?.width || 2048;
                              const targetH = nodeDataRef.current.dimensions?.height || 2048;
                              const healed = await canvasSuperResolution(parentUrl, 2, { width: targetW, height: targetH });
                              if (healed && healed.imageUrl) {
                                if (targetKey) {
                                  await cacheLocalImage(targetKey, healed.imageUrl).catch(() => {});
                                }
                                if (fullImageRaw && fullImageRaw !== targetKey) {
                                  await cacheLocalImage(fullImageRaw, healed.imageUrl).catch(() => {});
                                }
                                if (targetKey) primeCanvasThumbnail(targetKey, healed.imageUrl);
                                if (fullImageRaw) primeCanvasThumbnail(fullImageRaw, healed.imageUrl);
                                setResolvedImageUrl(healed.imageUrl);
                                setImgError(false);
                                return;
                              }
                            }
                          } catch {}
                        }

                        // 3. If displayImage is a remote URL that hit CORS or hotlink protection, recover via Tauri url_to_base64
                        const remoteUrl = (displayImage && (displayImage.startsWith('http://') || displayImage.startsWith('https://'))) 
                          ? displayImage 
                          : (fallbackKey && (fallbackKey.startsWith('http://') || fallbackKey.startsWith('https://'))) 
                            ? fallbackKey 
                            : null;
                        if (remoteUrl) {
                          try {
                            const { invoke } = await import('@tauri-apps/api/core');
                            const b64 = await invoke<string>('url_to_base64', { url: remoteUrl });
                            if (b64 && b64.startsWith('data:')) {
                              setResolvedImageUrl(b64);
                              setImgError(false);
                              return;
                            }
                          } catch {}
                        }

                        // 4. Resilient fallback: If displayImage (e.g. thumbnail) failed, try fullImageRaw directly
                        if (fullImageRaw && resolvedImageUrl !== fullImageRaw) {
                          if (displayImageRaw) invalidateCanvasThumbnail(displayImageRaw);
                          if (fullImageRaw) invalidateCanvasThumbnail(fullImageRaw);
                          if (fullImageRaw.startsWith('idb://')) {
                            const fallbackUrl = await getLocalImageAsObjectURL(fullImageRaw);
                            if (fallbackUrl && !fallbackUrl.startsWith('idb://')) {
                              setResolvedImageUrl(fallbackUrl);
                              setImgError(false);
                              return;
                            }
                          } else {
                            setResolvedImageUrl(fullImageRaw);
                            setImgError(false);
                            return;
                          }
                        }
                        setImgError(true);
                      }}
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
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!fullResolvedUrl && fullImageRaw) {
                            if (fullImageRaw.startsWith('idb://')) {
                              const u = await getLocalImageAsObjectURL(fullImageRaw);
                              if (u) setFullResolvedUrl(u);
                            } else {
                              setFullResolvedUrl(fullImageRaw);
                            }
                          }
                          setLightbox('expand');
                        }}
                      >
                        <Eye size={14} />
                      </button>
                      {!(isVideoNode(nodeData) || uploadedIsVideo) && (
                        <button
                          type="button"
                          className="image-action-btn mask"
                          title="Open AI Mask & Inpaint (Paintbrush)"
                          onClick={(e) => {
                            e.stopPropagation();
                            useAIConfigStore.getState().setSelectedNode({
                              id,
                              type: nodeData.type,
                              image: displayImageRaw || displayImage,
                              originalImage: nodeData.originalImage || displayImageRaw || displayImage,
                              state: nodeData.state || 'ready',
                              prompt: nodeData.prompt || '',
                            });
                            useAIConfigStore.getState().setPreviewMode('draw');
                            useAIConfigStore.getState().setIsEnlargedView(true);
                          }}
                        >
                          <Paintbrush2 size={14} />
                        </button>
                      )}
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
                          onClick={(e) => { e.stopPropagation(); setUploadedIsVideo(false); nodeData.onImageUpload?.(''); }}
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
          right: '-12px',
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
      {lightbox && (fullResolvedUrl || displayImage) && (
        <NodeLightbox
          lightbox={lightbox}
          displayImage={fullResolvedUrl || displayImage || ''}
          isVideo={isVideoNode(nodeData) || uploadedIsVideo}
          label={nodeData.label}
          nodeId={id}
          prompt={nodeData.prompt}
          onImageUpdate={(newUrl: string) => {
            setFullResolvedUrl(newUrl);
            setResolvedImageUrl(newUrl);
            if (nodeData.onImageUpload) {
              nodeData.onImageUpload(newUrl);
            }
            const updateFn = useAIConfigStore.getState().nodeImageUpdateFn;
            if (updateFn) {
              updateFn(id, newUrl);
            }
          }}
          onClose={() => setLightbox(null)}
        />
      )}
      <BaseNodePromptBar
        prompt={nodeData.prompt}
        copied={copied}
        onCopyPrompt={handleCopyPrompt}
      />
    </div>
  );
}, (prevProps, nextProps) => {
  if (prevProps.id !== nextProps.id) return false;
  if (Boolean(prevProps.selected) !== Boolean(nextProps.selected)) return false;

  const prevData = prevProps.data;
  const nextData = nextProps.data;
  if (prevData === nextData) return true;
  if (!prevData || !nextData) return false;

  return (
    prevData.state === nextData.state &&
    prevData.image === nextData.image &&
    prevData.thumbnail === nextData.thumbnail &&
    prevData.prompt === nextData.prompt &&
    prevData.label === nextData.label &&
    prevData.type === nextData.type &&
    prevData.processingType === nextData.processingType &&
    prevData.updatedAt === nextData.updatedAt &&
    prevData.semantic === nextData.semantic &&
    prevData.enableWatermark === nextData.enableWatermark &&
    prevData.isVideo === nextData.isVideo &&
    prevData.outputData?.image === nextData.outputData?.image &&
    prevData.outputData?.thumbnail === nextData.outputData?.thumbnail &&
    prevData.outputData?.dimensions?.width === nextData.outputData?.dimensions?.width &&
    prevData.outputData?.dimensions?.height === nextData.outputData?.dimensions?.height &&
    prevData.dimensions?.width === nextData.dimensions?.width &&
    prevData.dimensions?.height === nextData.dimensions?.height
  );
});

