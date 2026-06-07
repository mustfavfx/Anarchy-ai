import React, { useLayoutEffect, useEffect, useRef, useState } from 'react';
import { 
  Copy, Clipboard as ClipboardIcon, X,
  RotateCcw, RotateCw, Plus, LayoutGrid, Maximize2,
  Save, FolderOpen, FolderDown, Download,
  Trash2, SplitSquareHorizontal,
  FileText
} from 'lucide-react';
import { logger } from '../../../utils/logger';

export type ContextAction = 
  | 'add-source' 
  | 'rearrange' 
  | 'spawn-ghost' 
  | 'retry-node' 
  | 'delete-node' 
  | 'compare-a' 
  | 'compare-b' 
  | 'save-node-image' 
  | 'export-dxf' 
  | 'analyze-plan'
  | 'export-all' 
  | 'export-pdf' 
  | 'save-project' 
  | 'load-project'
  | 'open-images-folder'
  | 'export-node-pdf';

interface BuilderContextMenuProps {
  contextMenu: {
    x: number;
    y: number;
    canvasX?: number;
    canvasY?: number;
    type: 'canvas' | 'node' | 'prompt';
    nodeId?: string;
  } | null;
  onClose: () => void;
  nodes: any[];
  selectedNode: any;
  prompt: string;
  setPrompt: (prompt: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  handleNewCanvas: () => void;
  onAction: (action: ContextAction) => void;
  fitView: (options?: any) => void;
  imageFileToDataUrl: (file: File) => Promise<string>;
  spawnFromImage: (dataUrl: string, position?: { x: number; y: number }) => Promise<void>;
}

export const BuilderContextMenu: React.FC<BuilderContextMenuProps> = ({
  contextMenu,
  onClose,
  nodes,
  selectedNode,
  prompt,
  setPrompt,
  canUndo,
  canRedo,
  undo,
  redo,
  handleNewCanvas,
  onAction,
  fitView,
  imageFileToDataUrl,
  spawnFromImage,
}) => {
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({ visibility: 'hidden' });

  useLayoutEffect(() => {
    if (!contextMenu) {
      setMenuStyle({ visibility: 'hidden' });
      return;
    }
    if (!contextMenuRef.current) return;
    const el = contextMenuRef.current;
    const menuW = el.offsetWidth;
    const menuH = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 8;
    let left = contextMenu.x;
    let top = contextMenu.y;
    if (left + menuW + margin > vw) left = Math.max(margin, left - menuW);
    if (top + menuH + margin > vh) top = Math.max(margin, vh - menuH - margin);
    setMenuStyle({ left, top, visibility: 'visible', position: 'fixed', zIndex: 9999 });
  }, [contextMenu]);

  useEffect(() => {
    if (!contextMenu) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const menuEl = contextMenuRef.current;
      if (menuEl && e.target instanceof Node && menuEl.contains(e.target)) {
        return;
      }
      onClose();
    };
    
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    globalThis.addEventListener('mousedown', handleMouseDown);
    globalThis.addEventListener('keydown', handleEsc);

    return () => {
      globalThis.removeEventListener('mousedown', handleMouseDown);
      globalThis.removeEventListener('keydown', handleEsc);
    };
  }, [contextMenu, onClose]);

  if (!contextMenu) return null;

  const contextNode = contextMenu.type === 'node'
    ? nodes.find(n => n.id === contextMenu.nodeId)
    : undefined;



  const canDeleteContextNode = !!(
    contextNode &&
    (contextNode.data as any)?.type !== 'source'
  );

  const contextNodeHasImage = !!(
    contextNode &&
    ((contextNode.data as any)?.image || (contextNode.data as any)?.outputData?.image)
  );

  const canvasHasAnyImage = nodes.some(n => {
    const d = n.data as any;
    return !!(d?.image || d?.outputData?.image);
  });

  return (
    <div
      ref={contextMenuRef}
      className="builder-context-menu"
      style={menuStyle}
      role="menu"
      aria-label="Context menu"
      tabIndex={-1}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div className="context-menu-title">
        {contextMenu.type === 'canvas' && 'Canvas Menu'}
        {contextMenu.type === 'node' && 'Node Menu'}
        {contextMenu.type === 'prompt' && 'Prompt Menu'}
      </div>

      {contextMenu.type === 'prompt' && (
        <>
          <div className="context-section-label">Text Actions</div>

          <button type="button" className="context-item" onClick={() => {
            navigator.clipboard.writeText(prompt);
            onClose();
          }}>
            <Copy size={14} className="context-icon" />
            <span className="context-main">Copy Prompt</span>
          </button>

          <button type="button" className="context-item" onClick={async () => {
            onClose();
            try {
              const text = await navigator.clipboard.readText();
              setPrompt(text);
            } catch (err) {
              logger.log('[Paste] Prompt read failed:', err);
            }
          }}>
            <ClipboardIcon size={14} className="context-icon" />
            <span className="context-main">Paste from Clipboard</span>
          </button>

          <button type="button" className="context-item" onClick={() => {
            setPrompt('');
            onClose();
          }}>
            <X size={14} className="context-icon" />
            <span className="context-main">Clear Prompt</span>
          </button>

          <div className="context-section-label">History</div>

          <button type="button" className="context-item" onClick={() => {
            if (selectedNode && (selectedNode.data as any)?.prompt) {
              setPrompt((selectedNode.data as any).prompt);
              onClose();
            }
          }} disabled={!selectedNode || !(selectedNode.data as any)?.prompt}>
            <RotateCcw size={14} className="context-icon" />
            <span className="context-main">Restore Last Prompt</span>
          </button>
        </>
      )}

      {contextMenu.type === 'canvas' && (
        <>
          <div className="context-section-label">Workflow</div>

          <button type="button" className="context-item" onClick={(e) => { e.stopPropagation(); onAction('add-source'); }}>
            <Plus size={14} className="context-icon" />
            <span className="context-main">Add Source Node</span>
          </button>

          <button type="button" className="context-item" onClick={async () => {
            onClose();
            try {
              const items = await navigator.clipboard.read();
              for (const item of items) {
                const imgType = item.types.find(t => t.startsWith('image/'));
                if (imgType) {
                  const blob = await item.getType(imgType);
                  const dataUrl = await imageFileToDataUrl(new File([blob], 'paste.png', { type: imgType }));
                  const canvasPos = contextMenu.canvasX !== undefined && contextMenu.canvasY !== undefined
                    ? { x: contextMenu.canvasX, y: contextMenu.canvasY }
                    : undefined;
                  await spawnFromImage(dataUrl, canvasPos);
                  break;
                }
              }
            } catch (err) {
              logger.log('[Paste] Clipboard failed:', err);
              alert('No image found in clipboard');
            }
          }}>
            <ClipboardIcon size={14} className="context-icon" />
            <span className="context-main">Paste Image</span>
          </button>

          <button type="button" className="context-item" onClick={(e) => { e.stopPropagation(); onAction('rearrange'); }}>
            <LayoutGrid size={14} className="context-icon" />
            <span className="context-main">Rearrange Graph</span>
          </button>

          <button type="button" className="context-item" onClick={() => { fitView({ padding: 0.2, duration: 400 }); onClose(); }}>
            <Maximize2 size={14} className="context-icon" />
            <span className="context-main">Fit to View</span>
          </button>

          <div className="context-section-label">Edit</div>

          <button type="button" className="context-item" onClick={() => { undo(); onClose(); }} disabled={!canUndo}>
            <RotateCcw size={14} className="context-icon" />
            <span className="context-main">Undo</span>
          </button>

          <button type="button" className="context-item" onClick={() => { redo(); onClose(); }} disabled={!canRedo}>
            <RotateCw size={14} className="context-icon" />
            <span className="context-main">Redo</span>
          </button>

          <button type="button" className="context-item danger" onClick={() => { handleNewCanvas(); onClose(); }}>
            <X size={14} className="context-icon" />
            <span className="context-main">New Canvas</span>
          </button>

          <div className="context-section-label">Project</div>

          <button type="button" className="context-item" onClick={() => { onAction('save-project'); }}>
            <Save size={14} className="context-icon" />
            <span className="context-main">Save Project</span>
          </button>

          <button type="button" className="context-item" onClick={() => { onAction('load-project'); }}>
            <FolderOpen size={14} className="context-icon" />
            <span className="context-main">Open Project</span>
          </button>

          <div className="context-section-label">Export</div>

          <button
            type="button"
            className="context-item"
            onClick={() => { onAction('export-all'); }}
            disabled={!canvasHasAnyImage}
          >
            <FolderDown size={14} className="context-icon" />
            <span className="context-main">Export All Images</span>
          </button>

          <button
            type="button"
            className="context-item"
            onClick={() => { onAction('export-pdf'); }}
            disabled={!canvasHasAnyImage}
          >
            <Download size={14} className="context-icon" />
            <span className="context-main">Export to PDF</span>
          </button>
        </>
      )}

      {contextMenu.type !== 'prompt' && contextMenu.type !== 'canvas' && (
        <>
          <div className="context-section-label">Node Actions</div>

          {/* 
          <button
            type="button"
            className="context-item"
            onClick={(e) => { e.stopPropagation(); onAction('spawn-ghost'); }}
            disabled={!canSpawnFromContextNode}
          >
            <GitBranch size={14} className="context-icon" />
            <span className="context-main">Add Render Child</span>
          </button>

          <button
            type="button"
            className="context-item"
            onClick={() => { onAction('retry-node'); }}
            disabled={!canRetryContextNode}
          >
            <Sparkles size={14} className="context-icon" />
            <span className="context-main">Retry</span>
          </button>
          */}

          <button
            type="button"
            className="context-item"
            onClick={() => { onAction('save-node-image'); }}
            disabled={!contextNodeHasImage}
          >
            <Download size={14} className="context-icon" />
            <span className="context-main">Save Image</span>
          </button>

          <button
            type="button"
            className="context-item"
            onClick={() => { onAction('open-images-folder'); }}
          >
            <FolderOpen size={14} className="context-icon" />
            <span className="context-main">Open Images Folder</span>
          </button>

          <button
            type="button"
            className="context-item"
            onClick={() => { onAction('export-node-pdf'); }}
            disabled={!contextNodeHasImage}
          >
            <FileText size={14} className="context-icon" />
            <span className="context-main">Export to PDF</span>
          </button>

          {/* 
          <button
            type="button"
            className="context-item"
            onClick={() => { onAction('export-dxf'); }}
            disabled={!contextNodeHasImage}
          >
            <Download size={14} className="context-icon" />
            <span className="context-main">Export to CAD (DXF)</span>
          </button>

          <button
            type="button"
            className="context-item context-item--highlight"
            onClick={() => { onAction('analyze-plan'); }}
            disabled={!contextNodeHasImage}
          >
            <Download size={14} className="context-icon" />
            <span className="context-main">Analyze Floor Plan → CAD</span>
            <span className="context-badge">AI</span>
          </button>
          */}

          <button
            type="button"
            className="context-item danger"
            onClick={() => { onAction('delete-node'); }}
            disabled={!canDeleteContextNode}
          >
            <Trash2 size={14} className="context-icon" />
            <span className="context-main">Delete Node</span>
          </button>
          
          <div className="context-section-label">Compare</div>
          
          <button
            type="button"
            className="context-item"
            onClick={() => { onAction('compare-a'); }}
            disabled={!contextNodeHasImage}
          >
            <SplitSquareHorizontal size={14} className="context-icon" />
            <span className="context-main">Set as Image A</span>
          </button>
          
          <button
            type="button"
            className="context-item"
            onClick={() => { onAction('compare-b'); }}
            disabled={!contextNodeHasImage}
          >
            <SplitSquareHorizontal size={14} className="context-icon" />
            <span className="context-main">Set as Image B</span>
          </button>
        </>
      )}
    </div>
  );
};
