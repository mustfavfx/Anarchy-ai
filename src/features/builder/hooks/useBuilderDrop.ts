import { useState, useCallback, useEffect, useRef } from 'react';
import { logger } from '../../../utils/logger';
import { extractPngMetadata, type WorkflowMetadata } from '../../../services/image/ImageMetadataService';

// Check if running in a Tauri desktop environment
const isTauri = (): boolean => typeof globalThis !== 'undefined' && '__TAURI_INTERNALS__' in globalThis;

const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tiff'];

interface UseBuilderDropProps {
  spawnFromImage: (url: string) => Promise<void>;
  imageFileToDataUrl: (file: File) => Promise<string>;
  applyWatermarkToSource: (url: string) => Promise<string>;
  createSourceNode: (img?: string, label?: string, position?: { x: number; y: number }) => string;
  setSelectedNodeId: (id: string | null) => void;
  setSelectedNode: (node: any) => void;
  addNotification: (notification: any) => void;
  onFileWorkflowDetected?: (dataUrl: string, metadata: WorkflowMetadata) => void;
}

export function useBuilderDrop({
  spawnFromImage,
  imageFileToDataUrl,
  applyWatermarkToSource,
  createSourceNode,
  setSelectedNodeId,
  setSelectedNode,
  addNotification,
  onFileWorkflowDetected,
}: UseBuilderDropProps) {
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const dropHandledRef = useRef(false);

  const handleFileProcess = useCallback(async (file: File) => {
    try {
      const dataUrl = await imageFileToDataUrl(file);
      const arrayBuffer = await file.arrayBuffer();
      const metadata = extractPngMetadata(new Uint8Array(arrayBuffer));

      if (metadata && (metadata.nodeTree || metadata.rootId || metadata.entryId) && onFileWorkflowDetected) {
        onFileWorkflowDetected(dataUrl, metadata);
      } else {
        await spawnFromImage(dataUrl);
      }
    } catch (err) {
      logger.error('[Drag & Drop] Failed file processing:', err);
    }
  }, [imageFileToDataUrl, onFileWorkflowDetected, spawnFromImage]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
      if (!isTauri()) setIsDraggingFile(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as HTMLElement)) {
      setIsDraggingFile(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
    if (dropHandledRef.current) return;
    if (isTauri()) return;
    
    const imageFiles = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    for (const file of imageFiles.slice(0, 5)) {
      await handleFileProcess(file);
    }
    
    const urlData = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    if (urlData && !imageFiles.length) {
      const imageUrl = urlData.trim();
      if (/\.(jpg|jpeg|png|webp|gif|bmp)$/i.exec(imageUrl)) {
        try {
          const watermarked = await applyWatermarkToSource(imageUrl);
          const nodeId = createSourceNode(watermarked);
          setSelectedNodeId(nodeId);
          setSelectedNode({ id: nodeId, type: 'source', image: watermarked, prompt: undefined, state: 'ready' });
          addNotification({ type: 'success', title: 'Image Added', message: 'From URL' });
        } catch (error) {
          logger.error('[Drag & Drop] Error loading URL:', error);
        }
      }
    }
  }, [handleFileProcess, createSourceNode, setSelectedNodeId, setSelectedNode, addNotification, applyWatermarkToSource]);

  const handleWindowDrop = useCallback(async (e: DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    if (!e.dataTransfer) return;
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    for (const file of files.slice(0, 5)) {
      await handleFileProcess(file);
    }
  }, [handleFileProcess]);

  useEffect(() => {
    let active = true;
    if (isTauri()) {
      import('@tauri-apps/api/event').then(({ listen }) => {
        if (!active) return;
        listen('tauri://drag-drop', async (event: any) => {
          const type = event.payload.type;
          if (type === 'over' || type === 'enter') {
            setIsDraggingFile(true);
          } else if (type === 'leave') {
            setIsDraggingFile(false);
          } else if (type === 'drop') {
            if (dropHandledRef.current) return;
            dropHandledRef.current = true;
            setIsDraggingFile(false);
            const paths: string[] = (event.payload as any).paths ?? [];
            for (const filePath of paths.slice(0, 5)) {
              const lower = filePath.toLowerCase();
              if (!IMAGE_EXTS.some(ext => lower.endsWith(ext))) continue;
              try {
                const { invoke } = await import('@tauri-apps/api/core');
                const dataUrl = await invoke<string>('read_local_image', { path: filePath });
                await spawnFromImage(dataUrl);
              } catch (err) {
                logger.error('[Tauri Drop] Failed to read file:', filePath, err);
              }
            }
            setTimeout(() => { dropHandledRef.current = false; }, 500);
          }
        });
      });
    }

    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) {
        e.preventDefault();
        setIsDraggingFile(true);
      }
    };

    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', handleWindowDrop);

    return () => {
      active = false;
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', handleWindowDrop);
    };
  }, [handleWindowDrop, spawnFromImage]);

  return {
    isDraggingFile,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
}
