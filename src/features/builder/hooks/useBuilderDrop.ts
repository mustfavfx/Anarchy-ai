import { useState, useCallback, useEffect, useRef } from 'react';
import { logger } from '../../../utils/logger';

// Check if running in a Tauri desktop environment
const isTauri = (): boolean => typeof globalThis !== 'undefined' && '__TAURI_INTERNALS__' in globalThis;

const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tiff'];

async function processDroppedFiles(
  paths: string[],
  spawnFromImage: (url: string) => Promise<void>
): Promise<void> {
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
}

async function processWebDropFiles(
  files: File[],
  imageFileToDataUrl: (f: File) => Promise<string>,
  spawnFromImage: (url: string) => Promise<void>
): Promise<void> {
  for (const file of files.slice(0, 5)) {
    try {
      const dataUrl = await imageFileToDataUrl(file);
      await spawnFromImage(dataUrl);
    } catch { /* skip */ }
  }
}

interface UseBuilderDropProps {
  spawnFromImage: (url: string) => Promise<void>;
  imageFileToDataUrl: (file: File) => Promise<string>;
  applyWatermarkToSource: (url: string) => Promise<string>;
  createSourceNode: (img?: string, label?: string, position?: { x: number; y: number }) => string;
  setSelectedNodeId: (id: string | null) => void;
  setSelectedNode: (node: any) => void;
  addNotification: (notification: any) => void;
}

export function useBuilderDrop({
  spawnFromImage,
  imageFileToDataUrl,
  applyWatermarkToSource,
  createSourceNode,
  setSelectedNodeId,
  setSelectedNode,
  addNotification,
}: UseBuilderDropProps) {
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const dropHandledRef = useRef(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
      // Only set overlay state in non-Tauri (web) mode
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
    // Skip if already handled by Tauri native handler
    if (dropHandledRef.current) return;
    // Also skip in Tauri env to let native handler work
    if (isTauri()) return;
    
    // Handle dropped files
    const imageFiles = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    for (const file of imageFiles.slice(0, 5)) {
      try {
        const dataUrl = await imageFileToDataUrl(file);
        await spawnFromImage(dataUrl);
      } catch (error) {
        logger.error('[Drag & Drop] Error processing file:', error);
      }
    }
    
    // Handle dropped URLs from browser (images dragged from websites)
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
  }, [imageFileToDataUrl, spawnFromImage, createSourceNode, setSelectedNodeId, setSelectedNode, addNotification, applyWatermarkToSource]);

  const handleTauriDragDrop = useCallback(async (event: any) => {
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
      await processDroppedFiles(paths, spawnFromImage);
      setTimeout(() => { dropHandledRef.current = false; }, 500);
    }
  }, [spawnFromImage]);

  const handleWindowDrop = useCallback(async (e: DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    if (!e.dataTransfer) return;
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    await processWebDropFiles(files, imageFileToDataUrl, spawnFromImage);
  }, [imageFileToDataUrl, spawnFromImage]);

  useEffect(() => {
    let active = true;
    let disposeFn: (() => void) | undefined;

    const setupTauriDrop = async () => {
      try {
        const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
        const appWindow = getCurrentWebviewWindow();
        const dispose = await appWindow.onDragDropEvent(handleTauriDragDrop);
        if (!active) {
          dispose();
        } else {
          disposeFn = dispose;
        }
      } catch {
        // Fallback: Tauri API not available (dev mode web), use HTML5 events
        const handleWindowDragOver = (e: DragEvent) => { e.preventDefault(); };
        globalThis.addEventListener('dragover', handleWindowDragOver);
        globalThis.addEventListener('drop', handleWindowDrop);
        const dispose = () => {
          globalThis.removeEventListener('dragover', handleWindowDragOver);
          globalThis.removeEventListener('drop', handleWindowDrop);
        };
        if (!active) {
          dispose();
        } else {
          disposeFn = dispose;
        }
      }
    };

    setupTauriDrop();
    return () => {
      active = false;
      if (disposeFn) {
        disposeFn();
      }
    };
  }, [handleTauriDragDrop, handleWindowDrop]);

  return {
    isDraggingFile,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
}
