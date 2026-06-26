import { useState, useEffect, useCallback } from 'react';
import { type Node } from '@xyflow/react';
import { invoke } from '@tauri-apps/api/core';
import { logger } from '../../../utils/logger';

// Check if running in a Tauri desktop environment
const isTauri = (): boolean => typeof globalThis !== 'undefined' && '__TAURI_INTERNALS__' in globalThis;

interface UseBuilderKeyboardProps {
  isActive?: boolean;
  handleSave: () => Promise<string | null>;
  handleSaveAs: () => Promise<string | null>;
  handleLoad: () => void;
  handleNewCanvas: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  selectedNodeId: string | null;
  nodes: Node[];
  deleteNode: (id: string) => void;
  setSelectedNodeId: (id: string | null) => void;
  createSourceNode: (img?: string, label?: string, position?: { x: number; y: number }) => string;
  updateNodeData: (id: string, data: any) => void;
  addNotification: (notification: any) => void;
  spawnFromImage: (url: string) => Promise<void>;
  imageFileToDataUrl: (file: File) => Promise<string>;
}

export function useBuilderKeyboard({
  isActive = true,
  handleSave,
  handleSaveAs,
  handleLoad,
  handleNewCanvas,
  undo,
  redo,
  canUndo,
  canRedo,
  selectedNodeId,
  nodes,
  deleteNode,
  setSelectedNodeId,
  createSourceNode,
  updateNodeData,
  addNotification,
  spawnFromImage,
  imageFileToDataUrl,
}: UseBuilderKeyboardProps) {
  const [copiedNode, setCopiedNode] = useState<any>(null);

  const pasteFromTauriClipboard = useCallback(async (): Promise<boolean> => {
    try {
      const dataUrl = await invoke<string>('read_clipboard_image');
      await spawnFromImage(dataUrl);
      return true;
    } catch {
      return false;
    }
  }, [spawnFromImage]);

  const pasteFromWebClipboard = useCallback(async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imgType = item.types.find(t => t.startsWith('image/'));
        if (!imgType) continue;
        const blob = await item.getType(imgType);
        const dataUrl = await imageFileToDataUrl(new File([blob], 'paste.png', { type: imgType }));
        await spawnFromImage(dataUrl);
        break;
      }
    } catch (err) {
      logger.log('[Paste] Web Clipboard failed:', err);
    }
  }, [imageFileToDataUrl, spawnFromImage]);

  useEffect(() => {
    const handlePasteShortcut = async () => {
      if (isTauri()) {
        const done = await pasteFromTauriClipboard();
        if (done) return;
      }
      await pasteFromWebClipboard();
    };

    const handlePaste = async (e: ClipboardEvent) => {
      if (!isActive) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      e.preventDefault();
      if (copiedNode) {
        const newNodeId = createSourceNode(copiedNode.image);
        if (copiedNode.prompt) {
          updateNodeData(newNodeId, { prompt: copiedNode.prompt });
        }
        addNotification({ type: 'success', title: 'Node Pasted', message: 'Image copied to canvas' });
      } else {
        await handlePasteShortcut();
      }
    };

    const handleKeyDown = async (e: KeyboardEvent) => {
      if (!isActive) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      // Handle Delete / Backspace key deletions (no Ctrl modifier needed)
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeId) {
          const node = nodes.find(n => n.id === selectedNodeId);
          if (node && (node.data as any)?.type !== 'source') {
            e.preventDefault();
            deleteNode(selectedNodeId);
            setSelectedNodeId(null);
          }
        }
        return;
      }

      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;

      const key = e.key.toLowerCase();

      switch (key) {
        case 'c':
          if (selectedNodeId) {
            const node = nodes.find(n => n.id === selectedNodeId);
            if (node && (node.data as any)?.image) {
              e.preventDefault();
              setCopiedNode({
                type: node.data.type,
                image: (node.data as any).image,
                prompt: (node.data as any).prompt
              });
              addNotification({ type: 'success', title: 'Node Copied', message: 'Press Ctrl+V to paste' });
            }
          }
          break;
        case 'n':
          e.preventDefault();
          handleNewCanvas();
          break;
        case 'z':
          e.preventDefault();
          if (e.shiftKey) {
            if (canRedo) redo();
          } else {
            if (canUndo) undo();
          }
          break;
        case 'y':
          e.preventDefault();
          if (canRedo) redo();
          break;
        case 's':
          e.preventDefault();
          if (e.shiftKey) {
            await handleSaveAs();
          } else {
            await handleSave();
          }
          break;
        case 'o':
          e.preventDefault();
          handleLoad();
          break;
        default:
          break;
      }
    };
    globalThis.addEventListener('keydown', handleKeyDown);
    globalThis.addEventListener('paste', handlePaste as any);
    return () => {
      globalThis.removeEventListener('keydown', handleKeyDown);
      globalThis.removeEventListener('paste', handlePaste as any);
    };
  }, [
    isActive,
    handleSave,
    handleSaveAs,
    handleLoad,
    handleNewCanvas,
    pasteFromTauriClipboard,
    pasteFromWebClipboard,
    undo,
    redo,
    canUndo,
    canRedo,
    selectedNodeId,
    nodes,
    deleteNode,
    setSelectedNodeId,
    copiedNode,
    setCopiedNode,
    createSourceNode,
    updateNodeData,
    addNotification
  ]);
}
