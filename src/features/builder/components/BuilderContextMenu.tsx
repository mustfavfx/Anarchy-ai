import React, { useLayoutEffect, useEffect, useRef, useState } from 'react';
import { 
  Copy, Clipboard as ClipboardIcon, X,
  RotateCcw, RotateCw, Plus, LayoutGrid, Maximize2,
  Save, FolderOpen, FolderDown, Download,
  Trash2, SplitSquareHorizontal,
  FileText, Wand2, Film, ChevronRight, Paintbrush, Sparkles
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
  | 'export-node-pdf'
  | 'draw-mask';

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
  onSpawnWithModel: (tool: 'image-editor' | 'image-upscaler' | 'video-creator' | 'anarchy-creator', model: string) => void;
}

interface MenuEngine {
  id: string;
  name: string;
  badge?: string;
}

interface MenuStation {
  id: 'image-editor' | 'image-upscaler' | 'video-creator' | 'anarchy-creator';
  name: string;
  icon: React.ReactNode;
  engines: MenuEngine[];
}

const STATIONS: MenuStation[] = [
  {
    id: 'anarchy-creator' as const,
    name: 'Anarchy Generation',
    icon: <Sparkles size={14} className="context-icon" />,
    engines: [
      { id: 'reve/create', name: 'Anarchy Create (v2)', badge: 'v2' },
      { id: 'reve/edit-fast', name: 'Anarchy Edit Fast', badge: 'Fast' },
      { id: 'reve/extract-layout', name: 'Anarchy Analysis (v2)', badge: 'Layout' },
      { id: 'reve/render-layout', name: 'Anarchy Render Layout', badge: 'Layout' },
      { id: 'reve/create-layout', name: 'Anarchy Create Layout', badge: 'Layout' },
      { id: 'reve/reconcile-layouts', name: 'Anarchy Reconcile Layouts', badge: 'Layout' }
    ]
  },
  {
    id: 'image-editor' as const,
    name: 'Image Editing',
    icon: <Wand2 size={14} className="context-icon" />,
    engines: [
      { id: 'google/nano-banana-2', name: 'Nano Banana 2', badge: 'New' },
      { id: 'google/nano-banana-2-lite', name: 'Nano Banana 2 Lite', badge: 'Lite' },
      { id: 'bytedance/seedream-5-pro', name: 'Seedream 5 Pro', badge: 'Pro' },
      { id: 'black-forest-labs/flux-2-pro', name: 'FLUX 2 Pro', badge: '8 Refs' },
      { id: 'openai/gpt-image-2', name: 'GPT Image 2' },
      { id: 'google/nano-banana-pro', name: 'Nano Banana Pro', badge: 'Pro' },
      { id: 'prunaai/p-image', name: 'Pruna P-Image', badge: 'Fast' },
      { id: 'krea/krea-2-large', name: 'Krea 2 Large', badge: 'Pro' }
    ]
  },
  {
    id: 'image-upscaler' as const,
    name: 'Image Upscaling',
    icon: <Maximize2 size={14} className="context-icon" />,
    engines: [
      { id: 'topazlabs/image-upscale', name: 'Topaz Labs Upscale' },
      { id: 'philz1337x/clarity-upscaler', name: 'Clarity Upscaler' },
      { id: 'prunaai/p-image-upscale', name: 'Pruna AI Upscale' }
    ]
  },
  {
    id: 'video-creator' as const,
    name: 'Video Studio',
    icon: <Film size={14} className="context-icon" />,
    engines: [
      { id: 'bytedance/seedance-2.0', name: 'Seedance 2.0', badge: 'Fast' },
      { id: 'kwaivgi/kling-v3-omni-video', name: 'Kling v3 Omni Video', badge: 'Pro' },
      { id: 'xai/grok-imagine-video-1.5', name: 'Grok Imagine Video 1.5' },
      { id: 'prunaai/p-video', name: 'Pruna AI P-Video' },
      { id: 'google/veo-3.1-fast', name: 'Google Veo 3.1 Fast', badge: '3.1 Fast' },
      { id: 'pixverse/pixverse-v6', name: 'PixVerse v6' },
      { id: 'openai/sora-2-pro', name: 'Sora 2 Pro', badge: 'Pro' }
    ]
  }
];

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
  onSpawnWithModel,
}) => {
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({ visibility: 'hidden' });

  const [activeStation, setActiveStation] = useState<'image-editor' | 'image-upscaler' | 'video-creator' | 'anarchy-creator' | null>(null);
  const [hoveredItemRect, setHoveredItemRect] = useState<DOMRect | null>(null);
  const timeoutRef = useRef<any>(null);

  const handleStationMouseEnter = (
    e: React.MouseEvent,
    stationId: 'image-editor' | 'image-upscaler' | 'video-creator' | 'anarchy-creator'
  ) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setActiveStation(stationId);
    setHoveredItemRect(e.currentTarget.getBoundingClientRect());
  };

  const handleStationMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setActiveStation(null);
    }, 120);
  };

  const handleSubmenuMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  const handleSubmenuMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setActiveStation(null);
    }, 120);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

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
    <>
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

          <button type="button" className="context-item" onClick={() => { onAction('rearrange'); onClose(); }}>
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
            className="context-item context-item--highlight"
            onClick={() => { onAction('draw-mask'); }}
            disabled={!contextNodeHasImage}
          >
            <Paintbrush size={14} className="context-icon" />
            <span className="context-main">Draw Mask / Inpaint</span>
            <span className="context-badge">AI</span>
          </button>

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

          <div className="context-section-label">Stations</div>
          {STATIONS.map((station) => (
            <button
              key={station.id}
              type="button"
              className={`context-item ${activeStation === station.id ? 'hovered' : ''}`}
              onMouseEnter={(e) => handleStationMouseEnter(e, station.id)}
              onMouseLeave={handleStationMouseLeave}
              disabled={!contextNodeHasImage}
            >
              {station.icon}
              <span className="context-main">{station.name}</span>
              <ChevronRight size={12} className="context-submenu-indicator" />
            </button>
          ))}
          
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

      {activeStation && hoveredItemRect && (
        <div
          className="context-submenu"
          style={{
            position: 'fixed',
            left: hoveredItemRect.right + 4 + 180 > window.innerWidth
              ? Math.max(4, hoveredItemRect.left - 180 - 4)
              : hoveredItemRect.right + 4,
            top: hoveredItemRect.top,
            zIndex: 99999,
          }}
          onMouseEnter={handleSubmenuMouseEnter}
          onMouseLeave={handleSubmenuMouseLeave}
        >
          {STATIONS.find(s => s.id === activeStation)?.engines.map((engine) => (
            <button
              key={engine.id}
              type="button"
              className="context-item"
              onClick={() => {
                onSpawnWithModel(activeStation, engine.id);
                onClose();
              }}
            >
              <span className="context-main">{engine.name}</span>
              {engine.badge && <span className="context-badge">{engine.badge}</span>}
            </button>
          ))}
        </div>
      )}
    </>
  );
};
