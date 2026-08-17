/**
 * LayoutEditor - Complete Reve Feature Suite with Anarchy AI Identity & Interactive Crop/Scale
 * Features:
 * 1. Far-Left Thumbnail History Strip (Switch base images & generation variations)
 * 2. Draggable Crop Handles (TL, TR, BL, BR, Top, Bottom, Left, Right) + Interactive Zoom controls (+, -, 100%)
 * 3. Live Image Scaling via Scale Slider & Zoom Engine
 * 4. Anarchy AI Dark Studio Theme (Unified dark glassmorphism, purple/rose gradients, slate accents)
 * 5. Full Reframe Engine (Reshoot / Relayout with Aspect Ratio & Scale Controls)
 * 6. Photo Adjustments Panel with Exposure, Contrast, Highlights, Shadows, Vibrance, Temperature, Tint, Blend Mode, and SHUFFLE (🎲) button
 * 7. Multi-level Object Hierarchy Tree with Crop Thumbnails & Expand Chevrons
 * 8. Inpaint Mask Brush & Sub-toolbar, Text Tool & Properties, Sticky Notes
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Layers, Sparkles, Loader2, RefreshCw, Tag, AlertCircle, Search, X,
  ChevronDown, ChevronRight, Edit3, MousePointer, SquareDashed, PenTool,
  Box, Type, FileText, Image as ImageIcon, Crop, Check, Trash2, Sliders,
  Shuffle, Upload, Camera, Paperclip, RotateCcw, ZoomIn, ZoomOut, Maximize,
  Download, Scan, AtSign, ArrowUp, MessageSquare, Key, Coins
} from 'lucide-react';
import { anarchyService } from '../../../services/anarchy/AnarchyService';
import { useAIConfigStore } from '../../../stores/aiConfigStore';
import { getHistory } from '../../../services/history/HistoryService';
import { useResolvedImage } from '../../../hooks';
import { logger } from '../../../utils/logger';
import { downloadImage } from '../../../utils/imageExport';
import { getModelCost, checkCreditBalance, deductCredits } from '../../../services/credit/creditService';
import { useAuth } from '../../auth/AuthContext';
import './LayoutEditor.css';

interface LayoutRegion {
  label: string;
  bbox: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
  prompt?: string;
  region_type?: string;
}

interface LayoutData {
  width?: number;
  height?: number;
  regions: LayoutRegion[];
}

interface TextOverlay {
  id: string;
  x: number;
  y: number;
  text: string;
  font: string;
  size: number;
  color: string;
  opacity: number;
}

interface StickyNote {
  id: string;
  x: number;
  y: number;
  text: string;
}

interface ImageAdjustments {
  exposure: number;
  contrast: number;
  highlights: number;
  shadows: number;
  vibrance: number;
  temperature: number;
  tint: number;
  blend: string;
}

interface CropBounds {
  x0: number; // percentage 0 - 1
  y0: number; // percentage 0 - 1
  x1: number; // percentage 0 - 1
  y1: number; // percentage 0 - 1
}

interface LayoutEditorProps {
  rawImage?: string | null;
  image?: string | null;
  initialLayout?: any;
  onApplyResult: (newImageUrl: string) => void;
  onLayoutExtracted?: (extractedLayout: any) => void;
  className?: string;
  isEnlargedView?: boolean;
}

interface TreeNode {
  originalIdx: number;
  reg: LayoutRegion;
  children: TreeNode[];
}

const REGION_COLORS = [
  '#8b5cf6', '#f43f5e', '#3b82f6', '#10b981', '#eab308',
  '#06b6d4', '#a855f7', '#f97316', '#ec4899', '#14b8a6',
];

const DEFAULT_ADJUSTMENTS: ImageAdjustments = {
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  vibrance: 0,
  temperature: 0,
  tint: 0,
  blend: 'normal'
};

const DEFAULT_CROP_BOUNDS: CropBounds = {
  x0: 0.05,
  y0: 0.05,
  x1: 0.95,
  y1: 0.95
};

const buildReveHierarchyTree = (regions: LayoutRegion[], searchQuery: string): TreeNode[] => {
  const allNodes: TreeNode[] = regions
    .map((reg, idx) => ({ originalIdx: idx, reg, children: [] }))
    .filter(({ reg }) => !searchQuery || reg.label.toLowerCase().includes(searchQuery.toLowerCase()));

  if (allNodes.length === 0) return [];

  const sorted = [...allNodes].sort((a, b) => {
    const areaA = (a.reg.bbox.x1 - a.reg.bbox.x0) * (a.reg.bbox.y1 - a.reg.bbox.y0);
    const areaB = (b.reg.bbox.x1 - b.reg.bbox.x0) * (b.reg.bbox.y1 - b.reg.bbox.y0);
    return areaB - areaA;
  });

  const rootNodes: TreeNode[] = [];

  sorted.forEach(node => {
    let parentNode: TreeNode | null = null;
    let minParentArea = Infinity;

    sorted.forEach(candidateParent => {
      if (candidateParent.originalIdx === node.originalIdx) return;

      const pBox = candidateParent.reg.bbox;
      const cBox = node.reg.bbox;

      const interX0 = Math.max(pBox.x0, cBox.x0);
      const interY0 = Math.max(pBox.y0, cBox.y0);
      const interX1 = Math.min(pBox.x1, cBox.x1);
      const interY1 = Math.min(pBox.y1, cBox.y1);

      if (interX1 > interX0 && interY1 > interY0) {
        const interArea = (interX1 - interX0) * (interY1 - interY0);
        const childArea = (cBox.x1 - cBox.x0) * (cBox.y1 - cBox.y0);

        if (childArea > 0 && interArea / childArea >= 0.65) {
          const pArea = (pBox.x1 - pBox.x0) * (pBox.y1 - pBox.y0);
          if (pArea > childArea && pArea < minParentArea) {
            parentNode = candidateParent;
            minParentArea = pArea;
          }
        }
      }
    });

    if (parentNode) {
      (parentNode as TreeNode).children.push(node);
    } else {
      rootNodes.push(node);
    }
  });

  return rootNodes;
};

const AnalyzedSceneCard: React.FC<{
  scene: any;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}> = ({ scene, isActive, onSelect, onDelete }) => {
  const resolvedUrl = useResolvedImage(scene.url);
  const displaySrc = resolvedUrl || (
    scene.url && typeof scene.url === 'string' && (scene.url.startsWith('http') || scene.url.startsWith('data:') || scene.url.startsWith('blob:'))
      ? scene.url
      : null
  );
  const [imgError, setImgError] = useState(false);

  const regionCount = scene.regionCount || scene.layout?.regions?.length || 0;
  const sceneTitle = scene.prompt && !scene.prompt.includes('Scene') && scene.prompt.length > 2
    ? scene.prompt
    : `Analyzed Scene (${regionCount} objects)`;

  return (
    <div
      className={`scene-card-item ${isActive ? 'active-scene' : ''}`}
      onClick={onSelect}
    >
      <div className="scene-thumb-wrapper">
        {displaySrc && !imgError ? (
          <img
            src={displaySrc}
            alt={sceneTitle}
            className="scene-thumb-img"
            onError={() => setImgError(true)}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', color: '#f43f5e' }}>
            {imgError ? <Layers size={18} /> : <Loader2 size={16} className="animate-spin" />}
          </div>
        )}
        <span className="scene-objects-badge">
          <Layers size={9} />
          {regionCount} Objects
        </span>
      </div>
      <div className="scene-details">
        <div className="scene-name" title={sceneTitle}>{sceneTitle}</div>
        <div className="scene-meta">
          <span className="scene-status-tag">Analyzed</span>
          {scene.timestamp && (
            <span className="scene-time">
              {new Date(scene.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        className="delete-scene-btn"
        title="Delete scene from library"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
};

export const LayoutEditor: React.FC<LayoutEditorProps> = ({
  rawImage: rawImageProp,
  image: imageProp,
  initialLayout,
  onApplyResult,
  onLayoutExtracted,
  className = '',
  isEnlargedView = false
}) => {
  const rawImage = rawImageProp || imageProp || null;
  const { user: authUser } = useAuth();
  const userId = authUser?.id || 'anon_user';
  const resolvedUrl = useResolvedImage(rawImage || undefined);
  const displayImage = resolvedUrl || rawImage || null;

  const [activeStageImage, setActiveStageImage] = useState<string | null>(displayImage);
  const [layout, setLayout] = useState<LayoutData | null>(null);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [selectedRegionIdx, setSelectedRegionIdx] = useState<number | null>(null);
  const [hoveredRegionIdx, setHoveredRegionIdx] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [regionPrompts, setRegionPrompts] = useState<Record<number, string>>({});
  const [cropThumbnails, setCropThumbnails] = useState<Record<number, string>>({});
  const [isGroupExpanded, setIsGroupExpanded] = useState<boolean>(true);
  const [activeEditingIdx, setActiveEditingIdx] = useState<number | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Record<number, boolean>>({});

  // Left Thumbnail History Strip State
  const [imageHistory, setImageHistory] = useState<string[]>([]);
  const [showKeyModal, setShowKeyModal] = useState<boolean>(false);
  const [inputKey, setInputKey] = useState<string>(() => localStorage.getItem('anarchy_api_key') || '');

interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  imageUrl?: string;
  isThinking?: boolean;
  time?: string;
}

  // Website-Style Mode Switcher & Saved Scenes Library State
  const [panelMode, setPanelMode] = useState<'edit' | 'chat'>('edit');
  const [savedScenesList, setSavedScenesList] = useState<any[]>(() => {
    try {
      const stored = localStorage.getItem('anarchy_saved_scenes_list');
      if (stored) return JSON.parse(stored);
    } catch {}
    return [];
  });

  const saveSceneToLibrary = (imageUrl: string, layoutData: any, promptText?: string) => {
    if (!imageUrl || !layoutData || !Array.isArray(layoutData.regions)) return;
    const regionCount = layoutData.regions.length;
    const newEntry = {
      id: `scene_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      url: imageUrl,
      prompt: promptText || 'Analyzed Scene',
      regionCount,
      timestamp: Date.now(),
      layout: layoutData
    };

    setSavedScenesList(prev => {
      const filtered = prev.filter(s => s.url !== imageUrl);
      const updated = [newEntry, ...filtered];
      try {
        localStorage.setItem('anarchy_saved_scenes_list', JSON.stringify(updated.slice(0, 50)));
      } catch {}
      return updated;
    });
  };

  const deleteSavedScene = (imageUrl: string) => {
    const cacheKey = anarchyService.getCacheKey(imageUrl);
    anarchyService.layoutCache.delete(cacheKey);
    try { localStorage.removeItem(`anarchy_layout_${cacheKey}`); } catch {}

    setSavedScenesList(prev => {
      const updated = prev.filter(s => s.url !== imageUrl);
      try {
        localStorage.setItem('anarchy_saved_scenes_list', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };
  const [askAnarchyPrompt, setAskAnarchyPrompt] = useState<string>('');
  const [showMentionMenu, setShowMentionMenu] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'agent',
      text: 'Hello! I am your Anarchy AI Agent. Ask me to reformat scenes, edit layout regions, or apply style modifications.',
      time: 'Just now'
    }
  ]);



  const handleSendAskAnarchy = async () => {
    const text = askAnarchyPrompt.trim();
    if (!text) return;
    setAskAnarchyPrompt('');

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      sender: 'user',
      text,
      time: 'Just now'
    };
    const agentMsgId = String(Date.now() + 1);

    setChatMessages(prev => [
      ...prev,
      userMsg,
      {
        id: agentMsgId,
        sender: 'agent',
        text: 'Analyzing scene composition and applying AI modification...',
        isThinking: true,
        time: 'Just now'
      }
    ]);
    setPanelMode('chat');

    const targetImage = activeStageImage || displayImage || rawImage;
    if (!targetImage) return;

    setIsRendering(true);

    try {
      const naturalExplainer = await geminiAgentService.generateAgentResponse(text, targetImage);

      const result = await anarchyService.generate(
        {
          model: 'reve/edit-fast',
          prompt: text,
          aspectRatio: 'match_input_image'
        },
        [targetImage]
      );

      if (result?.imageUrl) {
        onApplyResult(result.imageUrl);
        setActiveStageImage(result.imageUrl);
        setImageHistory(prev => [result.imageUrl, ...prev]);

        setChatMessages(prev =>
          prev.map(msg =>
            msg.id === agentMsgId
              ? {
                  ...msg,
                  text: naturalExplainer,
                  imageUrl: result.imageUrl,
                  isThinking: false,
                  time: 'Just now'
                }
              : msg
          )
        );
        setExtractError(null);
      } else {
        throw new Error('Agent generation returned no result');
      }
    } catch (err: any) {
      logger.error('[LayoutEditor] Agent Chat generation failed:', err);
      setChatMessages(prev =>
        prev.map(msg =>
          msg.id === agentMsgId
            ? {
                ...msg,
                text: `Sorry, I couldn't complete the modification: ${err?.message || 'API error'}`,
                isThinking: false,
                time: 'Just now'
              }
            : msg
        )
      );
    } finally {
      setIsRendering(false);
    }
  };

  // Interactive Region BBox Drag & Resize Engine State
  const [activeRegionHandle, setActiveRegionHandle] = useState<string | null>(null);
  const [regionDragStartPos, setRegionDragStartPos] = useState<{ x: number, y: number } | null>(null);
  const [initialRegionBbox, setInitialRegionBbox] = useState<CropBounds | null>(null);

  // Interactive Zoom & Scale Engine State
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [cropBounds, setCropBounds] = useState<CropBounds>(DEFAULT_CROP_BOUNDS);
  const [activeCropHandle, setActiveCropHandle] = useState<string | null>(null);
  const [cropDragStartPos, setCropDragStartPos] = useState<{ x: number, y: number } | null>(null);
  const [initialBoundsOnDrag, setInitialBoundsOnDrag] = useState<CropBounds | null>(null);

  // Active Tool Mode (8 Buttons + Adjust)
  const [activeToolbarTool, setActiveToolbarTool] = useState<'select' | 'bbox' | 'brush' | '3d' | 'text' | 'note' | 'image' | 'fit' | 'adjust'>('select');

  // Tool 2: Bounding Box Marquee Drawing
  const [isDrawingBbox, setIsDrawingBbox] = useState<boolean>(false);
  const [drawStart, setDrawStart] = useState<{ x: number, y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number, y: number } | null>(null);

  // Tool 3: Inpaint Mask Brush & Sub-toolbar
  const [brushSize, setBrushSize] = useState<number>(30);
  const [brushColor, setBrushColor] = useState<string>('#ec4899');
  const [isDrawingMask, setIsDrawingMask] = useState<boolean>(false);
  const [maskPrompt, setMaskPrompt] = useState<string>('');
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const lastBrushPosRef = useRef<{ x: number, y: number } | null>(null);

  // Tool 4: 3D Perspective Grid
  const [vanishingPoint, setVanishingPoint] = useState<{ x: number, y: number }>({ x: 0.5, y: 0.5 });
  const [isDragging3DVanishingPoint, setIsDragging3DVanishingPoint] = useState<boolean>(false);

  // Tool 5: Text Tool Dragging & State
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [activeTextId, setActiveTextId] = useState<string | null>(null);
  const [draggingTextId, setDraggingTextId] = useState<string | null>(null);
  const [textDragStartPos, setTextDragStartPos] = useState<{ x: number, y: number } | null>(null);
  const [initialTextPos, setInitialTextPos] = useState<{ x: number, y: number } | null>(null);

  // Tool 6: Sticky Notes Dragging & State
  const [stickyNotes, setStickyNotes] = useState<StickyNote[]>([]);
  const [draggingNoteId, setDraggingNoteId] = useState<string | null>(null);
  const [noteDragStartPos, setNoteDragStartPos] = useState<{ x: number, y: number } | null>(null);
  const [initialNotePos, setInitialNotePos] = useState<{ x: number, y: number } | null>(null);

  // Tool 7: Add Image Popup
  const [showAddImageMenu, setShowAddImageMenu] = useState<boolean>(false);

  // Tool 8: Reframe Engine State
  const [isReframeActive, setIsReframeActive] = useState<boolean>(false);
  const [reframeTab, setReframeTab] = useState<'reshoot' | 'relayout'>('reshoot');
  const [referenceImageMode, setReferenceImageMode] = useState<string>('As inspiration');
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<string>('Freeform');
  const [reframeScale, setReframeScale] = useState<number>(1.0);
  const [showAspectDropdown, setShowAspectDropdown] = useState<boolean>(false);
  const [relayoutSelections, setRelayoutSelections] = useState<Record<string, boolean>>({ 'LinkedIn banner': true });

  // Photo Adjustments State
  const [adjustments, setAdjustments] = useState<ImageAdjustments>(DEFAULT_ADJUSTMENTS);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (dataUrl) {
          setActiveStageImage(dataUrl);
          setImageHistory(prev => [dataUrl, ...prev]);
          setShowAddImageMenu(false);
          setExtractError(null);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const imageContainerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const ASPECT_RATIO_OPTIONS = [
    { label: 'Freeform', ratio: 'Freeform', sub: '' },
    { label: 'Story', ratio: '9:16', sub: '9:16' },
    { label: 'Instagram post', ratio: '4:5', sub: '4:5' },
    { label: 'Portrait', ratio: '3:4', sub: '3:4' },
    { label: 'Facebook post', ratio: '1:1', sub: '1:1' },
    { label: 'X banner', ratio: '3:1', sub: '3:1' },
    { label: 'Email header', ratio: '2:1', sub: '2:1' },
    { label: 'Poster', ratio: '2:3', sub: '2:3' },
    { label: 'Presentation', ratio: '4:3', sub: '4:3' },
    { label: 'Photo print', ratio: '3:2', sub: '3:2' },
    { label: 'Widescreen', ratio: '16:9', sub: '16:9' },
    { label: 'Cinematic', ratio: '21:9', sub: '21:9' },
    { label: 'LinkedIn banner', ratio: '4:1', sub: '4:1' },
  ];

  const RELAYOUT_CATEGORIES = [
    {
      category: 'Social',
      items: [
        { label: 'Story', ratio: '9:16' },
        { label: 'Instagram post', ratio: '4:5' },
        { label: 'Facebook post', ratio: '1:1' },
        { label: 'Pinterest Pin', ratio: '2:3' },
        { label: 'X banner', ratio: '3:1' },
        { label: 'LinkedIn banner', ratio: '4:1' },
        { label: 'YouTube thumbnail', ratio: '16:9' },
      ]
    },
    {
      category: 'Print',
      items: [
        { label: 'Poster', ratio: '2:3' },
        { label: 'Photo print', ratio: '3:2' },
        { label: 'A4', ratio: '210:297' },
      ]
    },
    {
      category: 'Screen',
      items: [
        { label: 'Widescreen', ratio: '16:9' },
        { label: 'Cinematic', ratio: '21:9' },
        { label: 'Presentation', ratio: '4:3' },
        { label: 'Email header', ratio: '2:1' },
      ]
    }
  ];

  // Sync display image to active stage image & history
  useEffect(() => {
    const current = displayImage || rawImage;
    if (current) {
      setActiveStageImage(current);
      setImageHistory(prev => (prev.includes(current) ? prev : [current, ...prev.slice(0, 5)]));
    }
  }, [displayImage, rawImage]);

  // Generate crop thumbnails from base image & bboxes
  useEffect(() => {
    const targetImage = activeStageImage || displayImage;
    if (!targetImage || !layout?.regions) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const thumbs: Record<number, string> = {};
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = 48;
      canvas.height = 48;

      layout.regions.forEach((reg, i) => {
        try {
          const sx = Math.max(0, reg.bbox.x0 * img.naturalWidth);
          const sy = Math.max(0, reg.bbox.y0 * img.naturalHeight);
          const sw = Math.min(img.naturalWidth - sx, (reg.bbox.x1 - reg.bbox.x0) * img.naturalWidth);
          const sh = Math.min(img.naturalHeight - sy, (reg.bbox.y1 - reg.bbox.y0) * img.naturalHeight);

          if (sw > 0 && sh > 0) {
            ctx.clearRect(0, 0, 48, 48);
            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 48, 48);
            thumbs[i] = canvas.toDataURL('image/jpeg', 0.85);
          }
        } catch (e) {
          logger.warn('[LayoutEditor] Crop thumbnail canvas export warning:', e);
        }
      });
      setCropThumbnails(thumbs);
    };
    img.src = targetImage;
  }, [activeStageImage, displayImage, layout]);

  // Sync layout state strictly to the active stage image / initialLayout
  useEffect(() => {
    const targetImage = activeStageImage || displayImage || rawImage;
    if (!targetImage) {
      setLayout(null);
      return;
    }

    // Always reset temporary layout states when active image changes
    setLayout(null);
    setExtractError(null);
    setSelectedRegionIdx(null);
    setHoveredRegionIdx(null);
    setCropThumbnails({});
    setRegionPrompts({});

    // 1. Check if initialLayout prop is passed and valid
    if (initialLayout && Array.isArray(initialLayout.regions) && initialLayout.regions.length > 0) {
      setLayout(initialLayout);
      const initialPrompts: Record<number, string> = {};
      const defaultExpanded: Record<number, boolean> = {};
      initialLayout.regions.forEach((reg: LayoutRegion, i: number) => {
        initialPrompts[i] = reg.prompt || '';
        defaultExpanded[i] = true;
      });
      setRegionPrompts(initialPrompts);
      setExpandedNodes(defaultExpanded);

      // Seed cache for all candidate keys
      const candidateKeys = [activeStageImage, displayImage, rawImage, imageProp].filter(Boolean) as string[];
      candidateKeys.forEach(img => {
        const k = anarchyService.getCacheKey(img);
        anarchyService.layoutCache.set(k, initialLayout);
        try { localStorage.setItem(`anarchy_layout_${k}`, JSON.stringify(initialLayout)); } catch {}
      });
      return;
    }

    // 2. Check candidate keys across memory cache and localStorage
    const candidateImages = [activeStageImage, displayImage, rawImage, imageProp].filter(Boolean) as string[];
    for (const imgCandidate of candidateImages) {
      const cacheKey = anarchyService.getCacheKey(imgCandidate);

      // Memory check
      const cachedMemory = anarchyService.layoutCache.get(cacheKey);
      if (cachedMemory && Array.isArray(cachedMemory.regions) && cachedMemory.regions.length > 0) {
        setLayout(cachedMemory);
        const initialPrompts: Record<number, string> = {};
        const defaultExpanded: Record<number, boolean> = {};
        cachedMemory.regions.forEach((reg: LayoutRegion, i: number) => {
          initialPrompts[i] = reg.prompt || '';
          defaultExpanded[i] = true;
        });
        setRegionPrompts(initialPrompts);
        setExpandedNodes(defaultExpanded);

        // Seed memory cache for other candidate keys
        candidateImages.forEach(img => {
          const k = anarchyService.getCacheKey(img);
          anarchyService.layoutCache.set(k, cachedMemory);
        });
        return;
      }

      // localStorage check
      try {
        const storedRaw = localStorage.getItem(`anarchy_layout_${cacheKey}`);
        if (storedRaw) {
          const parsed = JSON.parse(storedRaw);
          if (parsed && Array.isArray(parsed.regions) && parsed.regions.length > 0) {
            setLayout(parsed);
            const initialPrompts: Record<number, string> = {};
            const defaultExpanded: Record<number, boolean> = {};
            parsed.regions.forEach((reg: LayoutRegion, i: number) => {
              initialPrompts[i] = reg.prompt || '';
              defaultExpanded[i] = true;
            });
            setRegionPrompts(initialPrompts);
            setExpandedNodes(defaultExpanded);

            // Seed memory cache & localStorage for all keys
            candidateImages.forEach(img => {
              const k = anarchyService.getCacheKey(img);
              anarchyService.layoutCache.set(k, parsed);
              try { localStorage.setItem(`anarchy_layout_${k}`, JSON.stringify(parsed)); } catch {}
            });
            return;
          }
        }
      } catch {}
    }

    // If NOT cached for this image: keep layout = null so user sees unanalyzed state!
  }, [activeStageImage, displayImage, rawImage, imageProp, initialLayout]);

  // Resize Mask Canvas
  useEffect(() => {
    if (maskCanvasRef.current && stageRef.current) {
      maskCanvasRef.current.width = stageRef.current.clientWidth || 800;
      maskCanvasRef.current.height = stageRef.current.clientHeight || 600;
    }
  }, [activeToolbarTool]);

  const handleSelectRegion = (idx: number) => {
    setSelectedRegionIdx(idx);
    setActiveEditingIdx(idx);
    if (cardRefs.current[idx]) {
      cardRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  const toggleNodeExpand = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodes(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleExtractLayout = async (forceRefreshParam?: boolean | React.MouseEvent) => {
    const forceRefresh = typeof forceRefreshParam === 'boolean' ? forceRefreshParam : false;
    const targetImage = activeStageImage || displayImage || rawImage;
    if (!targetImage) return;

    const scanCost = getModelCost('reve/extract-layout');
    if (forceRefresh) {
      const check = await checkCreditBalance(userId, scanCost);
      if (!check.hasEnough) {
        setExtractError(`Insufficient credits! Scene layout scan requires ${scanCost} credits (Balance: ${check.balance}).`);
        return;
      }
    }

    setIsExtracting(true);
    setExtractError(null);
    setSelectedRegionIdx(null);
    setHoveredRegionIdx(null);

    try {
      const result = await anarchyService.extractLayout(targetImage, undefined, undefined, forceRefresh);
      if (result && Array.isArray(result.regions)) {
        setLayout(result);
        onLayoutExtracted?.(result);
        saveSceneToLibrary(targetImage, result);
        const initialPrompts: Record<number, string> = {};
        const defaultExpanded: Record<number, boolean> = {};
        result.regions.forEach((reg: LayoutRegion, i: number) => {
          initialPrompts[i] = reg.prompt || '';
          defaultExpanded[i] = true;
        });
        setRegionPrompts(initialPrompts);
        setExpandedNodes(defaultExpanded);

        if (forceRefresh) {
          await deductCredits(userId, scanCost, 'Anarchy AI Scene Layout Scan');
        }
      } else {
        throw new Error('Reve extract layout returned no regions');
      }
    } catch (err: any) {
      logger.error('[LayoutEditor] Extract layout failed:', err);

      // Graceful cache recovery check: strictly for THIS image cacheKey only!
      const cacheKey = anarchyService.getCacheKey(targetImage);
      const fallbackCache = anarchyService.layoutCache.get(cacheKey);
      
      if (fallbackCache && Array.isArray(fallbackCache.regions)) {
        logger.log('[LayoutEditor] Recovered layout successfully from cache fallback:', fallbackCache);
        setLayout(fallbackCache);
        onLayoutExtracted?.(fallbackCache);
        setExtractError(null);
        return;
      }

      const isRateLimit = err?.message?.toLowerCase().includes('too many requests');
      if (isRateLimit) {
        setExtractError('API Rate Limit (429): You are making requests too quickly. Please wait 10-15 seconds before retrying.');
      } else {
        setExtractError(err?.message || 'Failed to extract layout regions from image');
      }
    } finally {
      setIsExtracting(false);
    }
  };

  // Safe LocalStorage Helper with Quota Cleanup Defense
  const safeSetLocalStorage = (key: string, data: any) => {
    try {
      localStorage.setItem(key, typeof data === 'string' ? data : JSON.stringify(data));
    } catch (e) {
      logger.warn('[LayoutEditor] localStorage quota exceeded, pruning old layout caches...', e);
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('anarchy_layout_')) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.slice(0, Math.ceil(keysToRemove.length / 2)).forEach(k => localStorage.removeItem(k));
        localStorage.setItem(key, typeof data === 'string' ? data : JSON.stringify(data));
      } catch {}
    }
  };

  const handleApplyEdits = async () => {
    const targetImage = activeStageImage || displayImage || rawImage;
    if (!targetImage || !layout) return;
    setIsRendering(true);

    try {
      const modifiedRegions = layout.regions.map((reg, idx) => ({
        ...reg,
        prompt: regionPrompts[idx] !== undefined ? regionPrompts[idx] : (reg.prompt || '')
      }));

      const modifiedLayout = {
        ...layout,
        regions: modifiedRegions
      };

      const result = await anarchyService.renderLayout(modifiedLayout, [targetImage]);
      if (result?.imageUrl) {
        onApplyResult(result.imageUrl);
        onLayoutExtracted?.(modifiedLayout);
        saveSceneToLibrary(result.imageUrl, modifiedLayout);
        const base64 = await anarchyService.resolveImageToPngBase64(result.imageUrl);
        const cacheKey = anarchyService.getCacheKey(base64);
        anarchyService.layoutCache.set(cacheKey, modifiedLayout);
        safeSetLocalStorage(`anarchy_layout_${cacheKey}`, modifiedLayout);
        setActiveStageImage(result.imageUrl);
        setImageHistory(prev => [result.imageUrl, ...prev]);
        setExtractError(null);
      } else {
        throw new Error('Render layout did not return an image URL');
      }
    } catch (err: any) {
      logger.error('[LayoutEditor] Render layout failed:', err);
      setExtractError(err?.message || 'Failed to render modified layout');
    } finally {
      setIsRendering(false);
    }
  };

  /**
   * Generates a binary inpaint mask (Black background #000000, Solid Opaque White strokes #ffffff)
   * scaled precisely to targetImage's true natural resolution (img.naturalWidth x img.naturalHeight).
   */
  const exportBinaryInpaintMask = (
    displayCanvas: HTMLCanvasElement,
    targetImgUrl: string
  ): Promise<string | undefined> => {
    return new Promise((resolve) => {
      const img = new Image();
      if (targetImgUrl.startsWith('http://') || targetImgUrl.startsWith('https://')) {
        img.crossOrigin = 'anonymous';
      }
      img.onload = () => {
        try {
          const targetW = img.naturalWidth || 1024;
          const targetH = img.naturalHeight || 1024;

          const offCanvas = document.createElement('canvas');
          offCanvas.width = targetW;
          offCanvas.height = targetH;
          const ctx = offCanvas.getContext('2d');
          if (!ctx) {
            resolve(displayCanvas.toDataURL('image/png'));
            return;
          }

          // 1. Fill solid black background (#000000)
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, targetW, targetH);

          // 2. Draw display canvas content scaled up to target natural resolution
          ctx.drawImage(displayCanvas, 0, 0, targetW, targetH);

          // 3. Convert any painted pixel to solid 100% opaque white (#ffffff)
          const imgData = ctx.getImageData(0, 0, targetW, targetH);
          const data = imgData.data;
          let hasMaskPixels = false;

          for (let i = 0; i < data.length; i += 4) {
            const alpha = data[i + 3];
            if (alpha > 10) {
              data[i] = 255;     // R
              data[i + 1] = 255; // G
              data[i + 2] = 255; // B
              data[i + 3] = 255; // Alpha 100%
              hasMaskPixels = true;
            } else {
              data[i] = 0;       // R
              data[i + 1] = 0;   // G
              data[i + 2] = 0;   // B
              data[i + 3] = 255; // Alpha 100% Opaque Black
            }
          }

          if (!hasMaskPixels) {
            resolve(undefined);
            return;
          }

          ctx.putImageData(imgData, 0, 0);
          resolve(offCanvas.toDataURL('image/png'));
        } catch (e) {
          logger.warn('[LayoutEditor] Mask binary export failed, fallback to display canvas:', e);
          try {
            resolve(displayCanvas.toDataURL('image/png'));
          } catch {
            resolve(undefined);
          }
        }
      };
      img.onerror = () => {
        try {
          resolve(displayCanvas.toDataURL('image/png'));
        } catch {
          resolve(undefined);
        }
      };
      img.src = targetImgUrl;
    });
  };

  // Mask Brush API Inpainting Integration (Connected to Anarchy AI)
  const handleApplyMaskEdit = async () => {
    const targetImage = activeStageImage || displayImage || rawImage;
    if (!targetImage) return;
    setIsRendering(true);

    try {
      let maskBase64: string | undefined = undefined;
      const canvas = maskCanvasRef.current;
      if (canvas) {
        maskBase64 = await exportBinaryInpaintMask(canvas, targetImage);
      }

      const promptText = maskPrompt.trim() || 'Inpaint and modify masked region';
      const imagesPayload = maskBase64 ? [targetImage, maskBase64] : [targetImage];

      const result = await anarchyService.generate(
        {
          model: 'reve/edit-fast',
          prompt: promptText,
          aspectRatio: 'match_input_image'
        },
        imagesPayload
      );

      if (result?.imageUrl) {
        onApplyResult(result.imageUrl);
        setActiveStageImage(result.imageUrl);
        setImageHistory(prev => [result.imageUrl, ...prev]);
        clearMaskCanvas();
        setMaskPrompt('');
        setExtractError(null);
      } else {
        throw new Error('Mask edit generation returned no image result');
      }
    } catch (err: any) {
      logger.error('[LayoutEditor] Mask inpaint failed:', err);
      setExtractError(err?.message || 'Failed to generate mask inpaint edit');
    } finally {
      setIsRendering(false);
    }
  };

  // Studio Keyboard Shortcuts (V = Select, B = Brush, T = Text, R = Reframe, Escape = Cancel)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (e.key === 'v' || e.key === 'V') {
        setActiveToolbarTool('select');
        setIsReframeActive(false);
      } else if (e.key === 'b' || e.key === 'B') {
        setActiveToolbarTool('brush');
        setIsReframeActive(false);
      } else if (e.key === 't' || e.key === 'T') {
        setActiveToolbarTool('text');
        setIsReframeActive(false);
      } else if (e.key === 'r' || e.key === 'R') {
        setIsReframeActive(prev => !prev);
      } else if (e.key === 'Escape') {
        setActiveToolbarTool('select');
        setIsReframeActive(false);
        setSelectedRegionIdx(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleApplyReframe = async () => {
    const targetImage = activeStageImage || displayImage || rawImage;
    if (!targetImage) return;
    setIsRendering(true);

    try {
      const spanX = Math.max(0.1, cropBounds.x1 - cropBounds.x0);
      const spanY = Math.max(0.1, cropBounds.y1 - cropBounds.y0);

      // Remap existing layout regions to the expanded crop bounds
      const remappedRegions = (layout?.regions || []).map((reg) => {
        const origX0 = typeof reg.bbox === 'object' && !Array.isArray(reg.bbox) ? reg.bbox.x0 : (Array.isArray(reg.bbox) ? reg.bbox[1] : 0);
        const origY0 = typeof reg.bbox === 'object' && !Array.isArray(reg.bbox) ? reg.bbox.y0 : (Array.isArray(reg.bbox) ? reg.bbox[0] : 0);
        const origX1 = typeof reg.bbox === 'object' && !Array.isArray(reg.bbox) ? reg.bbox.x1 : (Array.isArray(reg.bbox) ? reg.bbox[3] : 1);
        const origY1 = typeof reg.bbox === 'object' && !Array.isArray(reg.bbox) ? reg.bbox.y1 : (Array.isArray(reg.bbox) ? reg.bbox[2] : 1);

        const rx0 = (origX0 - cropBounds.x0) / spanX;
        const ry0 = (origY0 - cropBounds.y0) / spanY;
        const rx1 = (origX1 - cropBounds.x0) / spanX;
        const ry1 = (origY1 - cropBounds.y0) / spanY;

        return {
          ...reg,
          bbox: {
            x0: Math.max(0, Math.min(1, rx0)),
            y0: Math.max(0, Math.min(1, ry0)),
            x1: Math.max(0, Math.min(1, rx1)),
            y1: Math.max(0, Math.min(1, ry1))
          }
        };
      });

      // Add base image original bounds inside expanded canvas as reference object if outpainted
      const isOutpainted = cropBounds.x0 < -0.01 || cropBounds.y0 < -0.01 || cropBounds.x1 > 1.01 || cropBounds.y1 > 1.01;
      if (isOutpainted) {
        const baseRefX0 = (0 - cropBounds.x0) / spanX;
        const baseRefY0 = (0 - cropBounds.y0) / spanY;
        const baseRefX1 = (1 - cropBounds.x0) / spanX;
        const baseRefY1 = (1 - cropBounds.y1) / spanY;
        remappedRegions.unshift({
          label: 'Original Scene',
          bbox: {
            x0: Math.max(0, Math.min(1, baseRefX0)),
            y0: Math.max(0, Math.min(1, baseRefY0)),
            x1: Math.max(0, Math.min(1, baseRefX1)),
            y1: Math.max(0, Math.min(1, baseRefY1))
          },
          prompt: 'Original image contents'
        });
      }

      const expandedLayout = {
        width: layout?.width || 1024,
        height: layout?.height || 1024,
        regions: remappedRegions
      };

      const result = await anarchyService.renderLayout(expandedLayout, [targetImage]);
      if (result?.imageUrl) {
        onApplyResult(result.imageUrl);
        const base64 = await anarchyService.resolveImageToPngBase64(result.imageUrl);
        const cacheKey = anarchyService.getCacheKey(base64);
        anarchyService.layoutCache.set(cacheKey, expandedLayout);
        safeSetLocalStorage(`anarchy_layout_${cacheKey}`, expandedLayout);
        setActiveStageImage(result.imageUrl);
        setImageHistory(prev => [result.imageUrl, ...prev]);
        setCropBounds(DEFAULT_CROP_BOUNDS);
        setExtractError(null);
      }
      setIsReframeActive(false);
    } catch (err: any) {
      logger.error('[LayoutEditor] Apply reframe failed:', err);
      setExtractError(err?.message || 'Failed to reframe/outpaint image');
    } finally {
      setIsRendering(false);
    }
  };

  // Shuffle Adjustments
  const handleShuffleAdjustments = () => {
    setAdjustments({
      exposure: Math.floor(Math.random() * 120) - 60,
      contrast: Math.floor(Math.random() * 120) - 60,
      highlights: Math.floor(Math.random() * 120) - 60,
      shadows: Math.floor(Math.random() * 120) - 60,
      vibrance: Math.floor(Math.random() * 120) - 60,
      temperature: Math.floor(Math.random() * 120) - 60,
      tint: Math.floor(Math.random() * 120) - 60,
      blend: 'normal'
    });
  };

  const handleResetAdjustments = () => {
    setAdjustments(DEFAULT_ADJUSTMENTS);
  };

  const getStageRelativePos = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!stageRef.current) return { x: 0, y: 0 };
    const rect = stageRef.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
    };
  };

  // Aspect Ratio Crop Preset Handler
  const applyAspectRatioToCrop = (ratioStr: string) => {
    setSelectedAspectRatio(ratioStr);
    if (ratioStr === 'Freeform') return;

    const ratioOption = ASPECT_RATIO_OPTIONS.find(o => o.label === ratioStr);
    const ratioVal = ratioOption?.ratio || ratioStr;
    const parts = ratioVal.split(':').map(Number);
    if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return;

    const targetAr = parts[0] / parts[1];
    let w = 0.85;
    let h = w / targetAr;

    if (h > 0.9) {
      h = 0.9;
      w = h * targetAr;
    }

    const x0 = Math.max(-0.5, (1 - w) / 2);
    const y0 = Math.max(-0.5, (1 - h) / 2);
    const x1 = x0 + w;
    const y1 = y0 + h;

    setCropBounds({ x0, y0, x1, y1 });
  };

  // Global Window Pointer Listeners during Active Dragging
  useEffect(() => {
    if (!activeCropHandle && !activeRegionHandle && !draggingTextId && !draggingNoteId && !isDragging3DVanishingPoint) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      if (!stageRef.current) return;
      const rect = stageRef.current.getBoundingClientRect();

      // 3D Vanishing Point Dragging
      if (isDragging3DVanishingPoint) {
        const x = Math.max(0.1, Math.min(0.9, (e.clientX - rect.left) / rect.width));
        const y = Math.max(0.1, Math.min(0.9, (e.clientY - rect.top) / rect.height));
        setVanishingPoint({ x, y });
        return;
      }

      // Text Overlay Dragging
      if (draggingTextId && textDragStartPos && initialTextPos) {
        const dx = (e.clientX - textDragStartPos.x) / rect.width;
        const dy = (e.clientY - textDragStartPos.y) / rect.height;
        setTextOverlays(prev => prev.map(t => t.id === draggingTextId ? {
          ...t,
          x: Math.max(0, Math.min(0.95, initialTextPos.x + dx)),
          y: Math.max(0, Math.min(0.95, initialTextPos.y + dy))
        } : t));
        return;
      }

      // Sticky Note Dragging
      if (draggingNoteId && noteDragStartPos && initialNotePos) {
        const dx = (e.clientX - noteDragStartPos.x) / rect.width;
        const dy = (e.clientY - noteDragStartPos.y) / rect.height;
        setStickyNotes(prev => prev.map(n => n.id === draggingNoteId ? {
          ...n,
          x: Math.max(0, Math.min(0.85, initialNotePos.x + dx)),
          y: Math.max(0, Math.min(0.85, initialNotePos.y + dy))
        } : n));
        return;
      }

      // Draggable Region BBox Handle Processing (Strict 0..1 Image Bounds)
      if (activeRegionHandle && selectedRegionIdx !== null && regionDragStartPos && initialRegionBbox) {
        const dx = (e.clientX - regionDragStartPos.x) / rect.width;
        const dy = (e.clientY - regionDragStartPos.y) / rect.height;

        setLayout(prev => {
          if (!prev || !prev.regions[selectedRegionIdx]) return prev;
          const newRegions = [...prev.regions];
          let { x0, y0, x1, y1 } = initialRegionBbox;
          const w = x1 - x0;
          const h = y1 - y0;

          if (activeRegionHandle === 'move') {
            x0 = Math.max(0, Math.min(1 - w, x0 + dx));
            y0 = Math.max(0, Math.min(1 - h, y0 + dy));
            x1 = x0 + w;
            y1 = y0 + h;
          } else {
            if (activeRegionHandle.includes('left')) x0 = Math.min(x1 - 0.04, Math.max(0, x0 + dx));
            if (activeRegionHandle.includes('right')) x1 = Math.max(x0 + 0.04, Math.min(1, x1 + dx));
            if (activeRegionHandle.includes('top')) y0 = Math.min(y1 - 0.04, Math.max(0, y0 + dy));
            if (activeRegionHandle.includes('bottom')) y1 = Math.max(y0 + 0.04, Math.min(1, y1 + dy));
          }

          newRegions[selectedRegionIdx] = {
            ...newRegions[selectedRegionIdx],
            bbox: { x0, y0, x1, y1 }
          };
          return { ...prev, regions: newRegions };
        });
        return;
      }

      // Draggable Crop / Outpaint Handle Processing (Supports Outpainting -1.5..2.5)
      if (activeCropHandle && cropDragStartPos && initialBoundsOnDrag) {
        const dx = (e.clientX - cropDragStartPos.x) / rect.width;
        const dy = (e.clientY - cropDragStartPos.y) / rect.height;

        setCropBounds(() => {
          let { x0, y0, x1, y1 } = initialBoundsOnDrag;

          if (activeCropHandle === 'move') {
            const w = initialBoundsOnDrag.x1 - initialBoundsOnDrag.x0;
            const h = initialBoundsOnDrag.y1 - initialBoundsOnDrag.y0;
            x0 = Math.max(-1.5, Math.min(2.5 - w, initialBoundsOnDrag.x0 + dx));
            y0 = Math.max(-1.5, Math.min(2.5 - h, initialBoundsOnDrag.y0 + dy));
            x1 = x0 + w;
            y1 = y0 + h;
          } else {
            if (activeCropHandle.includes('left')) x0 = Math.min(x1 - 0.05, Math.max(-1.5, x0 + dx));
            if (activeCropHandle.includes('right')) x1 = Math.max(x0 + 0.05, Math.min(2.5, x1 + dx));
            if (activeCropHandle.includes('top')) y0 = Math.min(y1 - 0.05, Math.max(-1.5, y0 + dy));
            if (activeCropHandle.includes('bottom')) y1 = Math.max(y0 + 0.05, Math.min(2.5, y1 + dy));
          }

          return { x0, y0, x1, y1 };
        });
      }
    };

    const handleWindowMouseUp = () => {
      setActiveCropHandle(null);
      setCropDragStartPos(null);
      setInitialBoundsOnDrag(null);
      setActiveRegionHandle(null);
      setRegionDragStartPos(null);
      setInitialRegionBbox(null);
      setDraggingTextId(null);
      setTextDragStartPos(null);
      setInitialTextPos(null);
      setDraggingNoteId(null);
      setNoteDragStartPos(null);
      setInitialNotePos(null);
      setIsDragging3DVanishingPoint(false);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [activeCropHandle, activeRegionHandle, cropDragStartPos, initialBoundsOnDrag, regionDragStartPos, initialRegionBbox, selectedRegionIdx, draggingTextId, textDragStartPos, initialTextPos, draggingNoteId, noteDragStartPos, initialNotePos, isDragging3DVanishingPoint]);

  // Interactive Region BBox Drag & Resize Handlers
  const handleRegionHandleMouseDown = (handle: string, idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedRegionIdx(idx);
    setActiveEditingIdx(idx);
    setActiveRegionHandle(handle);
    if (stageRef.current && layout?.regions[idx]) {
      setRegionDragStartPos({ x: e.clientX, y: e.clientY });
      setInitialRegionBbox({ ...layout.regions[idx].bbox });
    }
  };

  // Interactive Crop Handle Dragging
  const handleCropHandleMouseDown = (handle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveCropHandle(handle);
    if (stageRef.current) {
      setCropDragStartPos({ x: e.clientX, y: e.clientY });
      setInitialBoundsOnDrag({ ...cropBounds });
    }
  };

  const handleStageMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeCropHandle || activeRegionHandle || draggingTextId || draggingNoteId || isDragging3DVanishingPoint) return;
    const pos = getStageRelativePos(e);

    if (activeToolbarTool === 'bbox') {
      setIsDrawingBbox(true);
      setDrawStart(pos);
      setDrawCurrent(pos);
    } else if (activeToolbarTool === 'brush') {
      setIsDrawingMask(true);
      lastBrushPosRef.current = null;
      paintMaskStroke(e);
    } else if (activeToolbarTool === 'text') {
      const newText: TextOverlay = {
        id: `text-${Date.now()}`,
        x: pos.x,
        y: pos.y,
        text: 'Text',
        font: 'Inter',
        size: 32,
        color: '#ffffff',
        opacity: 1.0
      };
      setTextOverlays(prev => [...prev, newText]);
      setActiveTextId(newText.id);
    } else if (activeToolbarTool === 'note') {
      const newNote: StickyNote = {
        id: `note-${Date.now()}`,
        x: pos.x,
        y: pos.y,
        text: 'Describe edits...'
      };
      setStickyNotes(prev => [...prev, newNote]);
    }
  };

  const handleStageMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const pos = getStageRelativePos(e);

    if (isDrawingBbox) {
      setDrawCurrent(pos);
    } else if (isDrawingMask) {
      paintMaskStroke(e);
    }
  };

  const handleStageMouseUp = () => {
    if (isDrawingBbox && drawStart && drawCurrent) {
      let x0 = Math.min(drawStart.x, drawCurrent.x);
      let y0 = Math.min(drawStart.y, drawCurrent.y);
      let x1 = Math.max(drawStart.x, drawCurrent.x);
      let y1 = Math.max(drawStart.y, drawCurrent.y);

      if (Math.abs(x1 - x0) < 0.02 && Math.abs(y1 - y0) < 0.02) {
        x0 = 0.3;
        y0 = 0.3;
        x1 = 0.7;
        y1 = 0.7;
      }

      const newRegion: LayoutRegion = {
        label: `New Object ${layout?.regions?.length ? layout.regions.length + 1 : 1}`,
        bbox: { x0, y0, x1, y1 },
        prompt: ''
      };

      setLayout(prev => ({
        ...prev,
        regions: [...(prev?.regions || []), newRegion]
      }));

      const newIdx = layout?.regions?.length || 0;
      setSelectedRegionIdx(newIdx);
      setActiveEditingIdx(newIdx);
    }

    setIsDrawingBbox(false);
    setDrawStart(null);
    setDrawCurrent(null);
    setIsDrawingMask(false);
    lastBrushPosRef.current = null;
  };

  const paintMaskStroke = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!maskCanvasRef.current || !stageRef.current) return;
    const ctx = maskCanvasRef.current.getContext('2d');
    if (!ctx) return;

    const rect = stageRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.fillStyle = `${brushColor}90`;
    ctx.strokeStyle = `${brushColor}90`;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (lastBrushPosRef.current) {
      ctx.beginPath();
      ctx.moveTo(lastBrushPosRef.current.x, lastBrushPosRef.current.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    lastBrushPosRef.current = { x, y };
  };

  const clearMaskCanvas = () => {
    if (!maskCanvasRef.current) return;
    const ctx = maskCanvasRef.current.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height);
    }
  };

  const toggleRelayoutSelection = (label: string) => {
    setRelayoutSelections(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const updateRegionPrompt = (idx: number, text: string) => {
    setRegionPrompts(prev => ({ ...prev, [idx]: text }));
  };

  const availableImages = React.useMemo(() => {
    const imagesMap = new Map<string, { url: string; prompt?: string; isAnalyzed?: boolean }>();

    // 1. Active stage / raw / display image
    if (activeStageImage) {
      imagesMap.set(activeStageImage, { url: activeStageImage, prompt: 'Current Stage Scene', isAnalyzed: true });
    }
    if (rawImage && !imagesMap.has(rawImage)) {
      imagesMap.set(rawImage, { url: rawImage, prompt: 'Selected Canvas Scene', isAnalyzed: true });
    }
    if (displayImage && !imagesMap.has(displayImage)) {
      imagesMap.set(displayImage, { url: displayImage, prompt: 'Display Scene', isAnalyzed: true });
    }

    // 2. From imageHistory
    imageHistory.forEach(url => {
      if (url && typeof url === 'string' && url.length > 10 && !imagesMap.has(url)) {
        const cacheKey = anarchyService.getCacheKey(url);
        imagesMap.set(url, {
          url,
          prompt: 'Generation Variation',
          isAnalyzed: anarchyService.layoutCache.has(cacheKey)
        });
      }
    });

    // 3. From canvas nodes (workflowSnapshot)
    try {
      const snap = useAIConfigStore.getState().workflowSnapshot;
      if (snap?.nodes) {
        snap.nodes.forEach((n: any) => {
          const data: any = n.data || {};
          const img = data.image || data.outputData?.image;
          if (img && typeof img === 'string' && img.length > 10 && !imagesMap.has(img)) {
            const cacheKey = anarchyService.getCacheKey(img);
            imagesMap.set(img, {
              url: img,
              prompt: (typeof data.prompt === 'string' ? data.prompt : data.label) || 'Canvas Node',
              isAnalyzed: anarchyService.layoutCache.has(cacheKey) || Boolean(data.extractedLayout || data.layout)
            });
          }
        });
      }
    } catch {}

    // 4. From HistoryService entries (getHistory)
    try {
      const historyEntries = getHistory();
      if (Array.isArray(historyEntries)) {
        historyEntries.forEach(entry => {
          const outImg = entry.outputImage;
          if (outImg && typeof outImg === 'string' && outImg.length > 10 && !imagesMap.has(outImg)) {
            const cacheKey = anarchyService.getCacheKey(outImg);
            imagesMap.set(outImg, {
              url: outImg,
              prompt: entry.prompt || entry.label || 'History Scene',
              isAnalyzed: anarchyService.layoutCache.has(cacheKey)
            });
          }

          const inImg = entry.inputImage;
          if (inImg && typeof inImg === 'string' && inImg.length > 10 && !imagesMap.has(inImg)) {
            const cacheKey = anarchyService.getCacheKey(inImg);
            imagesMap.set(inImg, {
              url: inImg,
              prompt: entry.prompt ? `Input: ${entry.prompt}` : 'History Input Scene',
              isAnalyzed: anarchyService.layoutCache.has(cacheKey)
            });
          }

          if (entry.nodeTree?.nodes) {
            entry.nodeTree.nodes.forEach(n => {
              if (n.image && typeof n.image === 'string' && n.image.length > 10 && !imagesMap.has(n.image)) {
                const cacheKey = anarchyService.getCacheKey(n.image);
                imagesMap.set(n.image, {
                  url: n.image,
                  prompt: n.prompt || 'Workflow Step Scene',
                  isAnalyzed: anarchyService.layoutCache.has(cacheKey)
                });
              }
            });
          }
        });
      }
    } catch {}

    // 5. From localStorage anarchy_layout_*
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('anarchy_layout_')) {
          const rawKey = key.replace('anarchy_layout_', '');
          if ((rawKey.startsWith('http') || rawKey.startsWith('data:') || rawKey.startsWith('blob:')) && !imagesMap.has(rawKey)) {
            imagesMap.set(rawKey, { url: rawKey, prompt: 'Analyzed Scene', isAnalyzed: true });
          }
        }
      }
    } catch {}

    return Array.from(imagesMap.values());
  }, [activeStageImage, rawImage, displayImage, imageHistory]);

  const combinedAnalyzedScenes = useMemo(() => {
    const sceneMap = new Map<string, any>();

    // 1. From savedScenesList
    savedScenesList.forEach(s => {
      if (s.url) sceneMap.set(s.url, s);
    });

    // 2. From availableImages that have layout cached
    availableImages.forEach(imgObj => {
      if (!imgObj.url) return;
      const cacheKey = anarchyService.getCacheKey(imgObj.url);
      const cached = anarchyService.layoutCache.get(cacheKey);
      if (cached && Array.isArray(cached.regions) && !sceneMap.has(imgObj.url)) {
        sceneMap.set(imgObj.url, {
          id: `img_${cacheKey}`,
          url: imgObj.url,
          prompt: imgObj.prompt || 'Analyzed Scene',
          regionCount: cached.regions.length,
          timestamp: Date.now(),
          layout: cached
        });
      }
    });

    // 3. Fallback: Include current stage/display/raw image if layout is active
    const targetImg = activeStageImage || displayImage || rawImage;
    if (targetImg && layout && Array.isArray(layout.regions) && layout.regions.length > 0 && !sceneMap.has(targetImg)) {
      sceneMap.set(targetImg, {
        id: `current_stage_${Date.now()}`,
        url: targetImg,
        prompt: 'Current Stage Scene',
        regionCount: layout.regions.length,
        timestamp: Date.now(),
        layout: layout
      });
    }

    return Array.from(sceneMap.values());
  }, [savedScenesList, availableImages, activeStageImage, displayImage, rawImage, layout]);

  const currentTargetImage = activeStageImage || displayImage || rawImage;

  if (!currentTargetImage) {
    return (
      <div className={`layout-editor-gallery-view anarchy-studio-theme ${className}`}>
        <div className="gallery-header">
          <div className="gallery-title-row">
            <Layers size={24} className="text-red" />
            <h2>Analyzed Scenes & Canvas Objects — Anarchy Analysis</h2>
          </div>
          <p className="gallery-subtitle">
            Select any previously analyzed scene or canvas image to extract and manage layout objects interactively.
          </p>
        </div>

        {availableImages.length === 0 ? (
          <div className="layout-editor-empty">
            <Layers size={40} className="empty-icon text-red" />
            <p style={{ marginTop: '12px', fontSize: '14px', color: '#94a3b8' }}>
              No analyzed scenes found yet. Create or select an image on the canvas to begin.
            </p>
          </div>
        ) : (
          <div className="analyzed-gallery-grid">
            {availableImages.map((item, idx) => (
              <div
                key={`${item.url.substring(0, 30)}-${idx}`}
                className="analyzed-gallery-card"
                onClick={() => {
                  setActiveStageImage(item.url);
                  setImageHistory(prev => (prev.includes(item.url) ? prev : [item.url, ...prev]));
                }}
              >
                <div className="gallery-thumb-wrapper">
                  <img
                    src={item.url}
                    alt={item.prompt || `Analyzed Scene ${idx + 1}`}
                    className="gallery-thumb-img"
                    onError={(e) => {
                      const card = (e.currentTarget as HTMLElement).closest('.analyzed-gallery-card');
                      if (card) (card as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div className="gallery-card-badge">
                    {item.isAnalyzed ? (
                      <span className="badge-analyzed">
                        <Sparkles size={11} /> Anarchy Analysis
                      </span>
                    ) : (
                      <span className="badge-canvas">
                        <Layers size={11} /> Canvas Scene
                      </span>
                    )}
                  </div>
                  <div className="gallery-card-overlay">
                    <button type="button" className="analyze-card-btn">
                      <Scan size={14} />
                      <span>Extract Layout & Layers</span>
                    </button>
                  </div>
                </div>
                <div className="gallery-card-footer">
                  <span className="gallery-card-title">{item.prompt || `Scene #${idx + 1}`}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const hierarchyTree = layout?.regions ? buildReveHierarchyTree(layout.regions, searchQuery) : [];
  const selectedRegion = selectedRegionIdx !== null && layout?.regions ? layout.regions[selectedRegionIdx] : null;

  // Compute CSS Filter string for Photo Adjustments
  const filterStyle = `
    brightness(${1 + adjustments.exposure / 100})
    contrast(${1 + adjustments.contrast / 100})
    saturate(${1 + adjustments.vibrance / 100})
    hue-rotate(${adjustments.tint}deg)
  `;

  // Scale & Zoom Combined Transform
  const totalScaleFactor = reframeScale * zoomLevel;

  // Recursive Tree Item Component
  const renderTreeItem = (node: TreeNode, depth: number = 0) => {
    const { originalIdx, reg, children } = node;
    const color = REGION_COLORS[originalIdx % REGION_COLORS.length];
    const isSelected = selectedRegionIdx === originalIdx;
    const isHovered = hoveredRegionIdx === originalIdx;
    const isEditing = activeEditingIdx === originalIdx;
    const hasChildren = children.length > 0;
    const isNodeExpanded = expandedNodes[originalIdx] ?? true;

    return (
      <div key={originalIdx} className="reve-tree-node-wrapper">
        <div
          ref={(el) => { cardRefs.current[originalIdx] = el; }}
          className={`reve-item-row depth-${depth} ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''}`}
          style={{ paddingLeft: `${8 + depth * 20}px` }}
          onClick={() => handleSelectRegion(originalIdx)}
          onMouseEnter={() => setHoveredRegionIdx(originalIdx)}
          onMouseLeave={() => setHoveredRegionIdx(null)}
        >
          <div className="reve-item-main">
            {hasChildren ? (
              <button
                type="button"
                className="reve-chevron-btn"
                onClick={(e) => toggleNodeExpand(originalIdx, e)}
              >
                {isNodeExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            ) : (
              <div className="reve-chevron-spacer" />
            )}

            {cropThumbnails[originalIdx] ? (
              <img src={cropThumbnails[originalIdx]} alt={reg.label} className="reve-item-thumb" />
            ) : (
              <div className="reve-item-thumb-placeholder" style={{ backgroundColor: `${color}30` }} />
            )}

            <span className="reve-item-label">{reg.label}</span>

            <button
              type="button"
              className={`reve-item-edit-btn ${isEditing ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                setActiveEditingIdx(isEditing ? null : originalIdx);
              }}
              title="Edit prompt"
            >
              {hasChildren && !isEditing ? (
                isNodeExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
              ) : (
                <Edit3 size={12} />
              )}
            </button>
          </div>

          {isEditing && (
            <div className="reve-edit-prompt-box" onClick={(e) => e.stopPropagation()}>
              <div className="box-title-row">
                <span className="box-title">Edit Prompt for {reg.label}</span>
                <button type="button" className="close-box-btn" onClick={() => setActiveEditingIdx(null)}>
                  <X size={12} />
                </button>
              </div>
              <textarea
                rows={2}
                className="reve-prompt-textarea"
                placeholder={`Specify changes for ${reg.label}...`}
                value={regionPrompts[originalIdx] ?? ''}
                onChange={(e) => updateRegionPrompt(originalIdx, e.target.value)}
              />
            </div>
          )}
        </div>

        {hasChildren && isNodeExpanded && (
          <div className="reve-tree-children">
            {children.map(child => renderTreeItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`layout-editor-container anarchy-studio-theme ${className}`}>
      {/* Top Header Bar */}
      <div className="layout-editor-header">
        <div className="header-title">
          <Layers size={16} className="title-icon text-red" />
          <span className="header-title-text">Interactive Layers & Objects</span>
          {layout?.regions && (
            <span className="badge-count" title={`${layout.regions.length} Objects`}>
              <span className="badge-full">{layout.regions.length} Objects</span>
              <span className="badge-short">{layout.regions.length}</span>
            </span>
          )}
        </div>
        
        <div className="header-right-actions">
          <button
            type="button"
            className="export-btn"
            onClick={() => {
              const target = activeStageImage || displayImage || rawImage;
              if (target) {
                downloadImage(target, 'anarchy-layer-scene');
              }
            }}
            title="Export current stage image"
          >
            <Download size={13} />
            <span className="btn-label">Export</span>
          </button>

          <button
            type="button"
            className={`adjust-toggle-btn ${activeToolbarTool === 'adjust' ? 'active' : ''}`}
            onClick={() => setActiveToolbarTool(activeToolbarTool === 'adjust' ? 'select' : 'adjust')}
            title="Adjust photo settings"
          >
            <Sliders size={13} />
            <span className="btn-label">Adjust</span>
          </button>

          <button
            type="button"
            className="refresh-btn scan-scene-btn"
            onClick={() => handleExtractLayout(true)}
            disabled={isExtracting || isRendering || !(activeStageImage || displayImage || rawImage)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: (!layout?.regions || layout.regions.length === 0)
                ? 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)'
                : 'rgba(30, 41, 59, 0.8)',
              color: '#ffffff',
              border: (!layout?.regions || layout.regions.length === 0)
                ? 'none'
                : '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: (isExtracting || isRendering || !(activeStageImage || displayImage || rawImage)) ? 'not-allowed' : 'pointer',
              boxShadow: (!layout?.regions || layout.regions.length === 0) ? '0 2px 8px rgba(225, 29, 72, 0.4)' : 'none',
              transition: 'all 0.15s ease'
            }}
            title={(!layout?.regions || layout.regions.length === 0) ? "Scan scene to extract 3D elements & layers" : "Re-extract layout regions from API"}
          >
            <RefreshCw size={13} className={isExtracting ? 'animate-spin' : ''} />
            <span className="btn-label">
              {isExtracting ? 'Scanning...' : (!layout?.regions || layout.regions.length === 0) ? 'Scan Scene' : 'Re-scan'}
            </span>
            <span style={{
              fontSize: '10px',
              background: 'rgba(0, 0, 0, 0.35)',
              padding: '1px 5px',
              borderRadius: '4px',
              color: '#fecdd3',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px'
            }}>
              <Coins size={10} /> {getModelCost('reve/extract-layout')} cr
            </span>
          </button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="layout-editor-body">
        {/* Stage Wrapper */}
        <div className="layout-canvas-wrapper" ref={imageContainerRef}>
          {/* Far-Left Thumbnail History Strip (Only rendered in Enlarged Expand Mode) */}
          {isEnlargedView && imageHistory.filter(url => Boolean(url && url.length > 10)).length > 0 && (
            <div className="reve-left-history-strip">
              <span className="strip-title">Generations</span>
              <div className="strip-thumbs-list">
                {imageHistory.filter(url => Boolean(url && url.length > 10)).map((imgUrl, i) => (
                  <div
                    key={`${imgUrl.substring(0, 30)}-${i}`}
                    className={`history-thumb-item ${activeStageImage === imgUrl ? 'active' : ''}`}
                    onClick={() => setActiveStageImage(imgUrl)}
                    title={`Variation ${i + 1}`}
                  >
                    <img
                      src={imgUrl}
                      alt={`Var ${i + 1}`}
                      className="thumb-img"
                      onError={(e) => {
                        const parent = (e.currentTarget as HTMLElement).parentElement;
                        if (parent) parent.style.display = 'none';
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Floating Stage Zoom Controls (Only rendered in Enlarged Expand Mode) */}
          {isEnlargedView && (
            <div className="stage-zoom-controls-pill">
              <button
                type="button"
                className="zoom-btn"
                onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.15))}
                title="Zoom Out"
              >
                <ZoomOut size={13} />
              </button>
              <span className="zoom-badge">{Math.round(totalScaleFactor * 100)}%</span>
              <button
                type="button"
                className="zoom-btn"
                onClick={() => setZoomLevel(prev => Math.min(3.0, prev + 0.15))}
                title="Zoom In"
              >
                <ZoomIn size={13} />
              </button>
              <button
                type="button"
                className="zoom-btn reset"
                onClick={() => { setZoomLevel(1.0); setReframeScale(1.0); }}
                title="Reset Zoom & Scale"
              >
                <Maximize size={12} />
              </button>
            </div>
          )}

          {/* Animated Cyberpunk Glass Creating/Rendering Tile Grid Overlay */}
          {(isExtracting || isRendering) && (
            <div className="layout-loading-overlay reve-creating-tiles-overlay">
              <div className="creating-grid-glow-bg" />
              <div className="creating-tiles-grid">
                <div className="scanning-laser-line" />
                {Array.from({ length: 16 }).map((_, i) => (
                  <div
                    key={i}
                    className="creating-tile"
                    style={{
                      animationDelay: `${(i % 4) * 0.15 + Math.floor(i / 4) * 0.1}s`
                    }}
                  >
                    <div className="tile-inner-shimmer" />
                  </div>
                ))}
              </div>
              <div className="creating-status-pill">
                <div className="pill-pulse-ring" />
                <Loader2 size={16} className="animate-spin text-red" />
                <span>{isExtracting ? 'Anarchy Analysis in progress...' : 'Anarchy Render & Synthesis...'}</span>
              </div>
            </div>
          )}
          
          {extractError && !isExtracting && (
            <div className="layout-error-overlay">
              <AlertCircle size={28} className="text-red" />
              <p style={{ maxWidth: '80%', textAlign: 'center', wordBreak: 'break-word', margin: 0 }}>{extractError}</p>
              <button type="button" onClick={() => handleExtractLayout(true)} disabled={isExtracting} className="retry-btn">
                {isExtracting ? <Loader2 size={13} className="animate-spin" /> : null}
                <span>{isExtracting ? 'Retrying...' : 'Retry Scan'}</span>
              </button>
            </div>
          )}

          {/* Image Stage Inner Container */}
          <div
            className={`image-stage-inner ${isReframeActive ? 'reframe-mode-active' : ''}`}
            ref={stageRef}
            onMouseDown={handleStageMouseDown}
            onMouseMove={handleStageMouseMove}
            onMouseUp={handleStageMouseUp}
            style={{ transform: `scale(${totalScaleFactor})`, transformOrigin: 'center center', transition: 'transform 0.15s ease-out' }}
          >
            <img
              src={resolvedUrl || activeStageImage || displayImage || rawImage || ''}
              alt="Base Scene"
              className="base-scene-image"
              style={{ filter: filterStyle }}
              onError={() => {
                if (activeStageImage && activeStageImage.startsWith('blob:') && rawImage && rawImage !== activeStageImage) {
                  setActiveStageImage(rawImage);
                }
              }}
            />

            {/* Tool 3: Mask Brush Canvas Overlay */}
            {activeToolbarTool === 'brush' && (
              <canvas ref={maskCanvasRef} className="interactive-mask-canvas" />
            )}

            {/* Tool 4: 3D Perspective Grid Overlay — draggable vanishing point */}
            {activeToolbarTool === '3d' && (
              <div className="interactive-3d-grid-overlay">
                {/* Perspective lines from corners to vanishing point */}
                <svg className="perspective-svg" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                  <line x1="0%" y1="0%" x2={`${vanishingPoint.x * 100}%`} y2={`${vanishingPoint.y * 100}%`} stroke="rgba(255,200,60,0.55)" strokeWidth="1" />
                  <line x1="100%" y1="0%" x2={`${vanishingPoint.x * 100}%`} y2={`${vanishingPoint.y * 100}%`} stroke="rgba(255,200,60,0.55)" strokeWidth="1" />
                  <line x1="0%" y1="100%" x2={`${vanishingPoint.x * 100}%`} y2={`${vanishingPoint.y * 100}%`} stroke="rgba(255,200,60,0.55)" strokeWidth="1" />
                  <line x1="100%" y1="100%" x2={`${vanishingPoint.x * 100}%`} y2={`${vanishingPoint.y * 100}%`} stroke="rgba(255,200,60,0.55)" strokeWidth="1" />
                  <line x1="50%" y1="0%" x2={`${vanishingPoint.x * 100}%`} y2={`${vanishingPoint.y * 100}%`} stroke="rgba(255,200,60,0.3)" strokeWidth="1" strokeDasharray="4 4" />
                  <line x1="0%" y1="50%" x2={`${vanishingPoint.x * 100}%`} y2={`${vanishingPoint.y * 100}%`} stroke="rgba(255,200,60,0.3)" strokeWidth="1" strokeDasharray="4 4" />
                  <line x1="100%" y1="50%" x2={`${vanishingPoint.x * 100}%`} y2={`${vanishingPoint.y * 100}%`} stroke="rgba(255,200,60,0.3)" strokeWidth="1" strokeDasharray="4 4" />
                  <line x1="50%" y1="100%" x2={`${vanishingPoint.x * 100}%`} y2={`${vanishingPoint.y * 100}%`} stroke="rgba(255,200,60,0.3)" strokeWidth="1" strokeDasharray="4 4" />
                </svg>
                {/* Draggable Vanishing Point */}
                <div
                  className="perspective-vanishing-point"
                  style={{ left: `${vanishingPoint.x * 100}%`, top: `${vanishingPoint.y * 100}%`, transform: 'translate(-50%, -50%)', cursor: 'crosshair' }}
                  onMouseDown={(e) => { e.stopPropagation(); setIsDragging3DVanishingPoint(true); }}
                  title="Drag to move vanishing point"
                />
              </div>
            )}

            {/* Tool 5: Interactive Text Overlays — draggable */}
            {textOverlays.map((txt) => (
              <div
                key={txt.id}
                className={`interactive-text-overlay ${activeTextId === txt.id ? 'active' : ''}`}
                style={{ left: `${txt.x * 100}%`, top: `${txt.y * 100}%`, opacity: txt.opacity }}
                onClick={(e) => { e.stopPropagation(); setActiveTextId(txt.id); }}
              >
                {/* Drag grip */}
                <div
                  className="overlay-drag-grip"
                  title="Drag to move"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setActiveTextId(txt.id);
                    setDraggingTextId(txt.id);
                    setTextDragStartPos({ x: e.clientX, y: e.clientY });
                    setInitialTextPos({ x: txt.x, y: txt.y });
                  }}
                >
                  ⠿
                </div>
                <input
                  type="text"
                  value={txt.text}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTextOverlays(prev => prev.map(t => t.id === txt.id ? { ...t, text: val } : t));
                  }}
                  className="text-overlay-input"
                  style={{ color: txt.color, fontSize: `${txt.size / 2}px` }}
                />
                <button
                  type="button"
                  className="delete-overlay-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTextOverlays(prev => prev.filter(t => t.id !== txt.id));
                  }}
                >
                  <X size={10} />
                </button>
              </div>
            ))}

            {/* Tool 6: Interactive Sticky Notes — draggable */}
            {stickyNotes.map((note) => (
              <div
                key={note.id}
                className="interactive-sticky-note"
                style={{ left: `${note.x * 100}%`, top: `${note.y * 100}%` }}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  className="note-header"
                  style={{ cursor: 'grab' }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setDraggingNoteId(note.id);
                    setNoteDragStartPos({ x: e.clientX, y: e.clientY });
                    setInitialNotePos({ x: note.x, y: note.y });
                  }}
                >
                  <span>📌 Pin Note</span>
                  <button
                    type="button"
                    className="delete-overlay-btn"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); setStickyNotes(prev => prev.filter(n => n.id !== note.id)); }}
                  >
                    <X size={10} />
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={note.text}
                  onChange={(e) => {
                    const val = e.target.value;
                    setStickyNotes(prev => prev.map(n => n.id === note.id ? { ...n, text: val } : n));
                  }}
                  className="note-textarea"
                />
              </div>
            ))}

            {/* Tool 2: Active Drawing Bbox Marquee */}
            {isDrawingBbox && drawStart && drawCurrent && (
              <div
                className="drawing-bbox-marquee"
                style={{
                  left: `${Math.min(drawStart.x, drawCurrent.x) * 100}%`,
                  top: `${Math.min(drawStart.y, drawCurrent.y) * 100}%`,
                  width: `${Math.abs(drawCurrent.x - drawStart.x) * 100}%`,
                  height: `${Math.abs(drawCurrent.y - drawStart.y) * 100}%`
                }}
              />
            )}

            {/* Reve Floating Prompt Card anchored to Selected Bbox (Screenshots 2 & 4) */}
            {selectedRegionIdx !== null && selectedRegion && !isReframeActive && (() => {
              const bbox = selectedRegion.bbox;
              let leftPct = bbox.x1 > 0.60 ? Math.max(2, bbox.x0 * 100 - 32) : bbox.x1 * 100 + 2;
              let topPct = bbox.y1 > 0.55 ? Math.max(2, bbox.y0 * 100 - 35) : bbox.y0 * 100;
              leftPct = Math.max(2, Math.min(62, leftPct));
              topPct = Math.max(2, Math.min(52, topPct));

              return (
                <div
                  className="reve-floating-edit-card"
                  style={{
                    left: `${leftPct}%`,
                    top: `${topPct}%`
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="reve-card-input-row">
                    <input
                      type="text"
                      className="reve-card-text-input"
                      placeholder="Describe edits..."
                      value={regionPrompts[selectedRegionIdx] ?? ''}
                      onChange={(e) => updateRegionPrompt(selectedRegionIdx, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleApplyEdits();
                        }
                      }}
                      autoFocus
                    />
                  </div>
                  <div className="reve-card-actions-row">
                    <div className="card-actions-left">
                      <button type="button" className="card-action-icon" title="Attach asset" onClick={() => fileInputRef.current?.click()}>
                        <Paperclip size={13} />
                      </button>
                      <button type="button" className="card-action-icon" title="Mention object (@)" onClick={() => updateRegionPrompt(selectedRegionIdx, (regionPrompts[selectedRegionIdx] || '') + ' @')}>
                        <AtSign size={13} />
                      </button>
                      <button type="button" className="card-action-icon rainbow-icon" title="AI Style Preset">
                        <Sparkles size={13} className="text-purple-grad" />
                      </button>
                    </div>
                    <div className="card-actions-right">
                      <button type="button" className="card-trash-btn" title="Delete region" onClick={() => setSelectedRegionIdx(null)}>
                        <Trash2 size={13} />
                      </button>
                      <button
                        type="button"
                        className="card-submit-btn"
                        title="Apply edits (2.1 credits)"
                        onClick={handleApplyEdits}
                        disabled={isRendering}
                      >
                        {isRendering ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Reve Floating Prompt Card anchored to Active Mask Brush (Screenshot 4) */}
            {activeToolbarTool === 'brush' && !isReframeActive && (
              <div
                className="reve-floating-edit-card mask-anchored-card"
                style={{
                  top: '25%',
                  right: '25px'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="reve-card-input-row">
                  <input
                    type="text"
                    className="reve-card-text-input"
                    placeholder="Describe edits..."
                    value={maskPrompt}
                    onChange={(e) => setMaskPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleApplyMaskEdit();
                      }
                    }}
                    autoFocus
                  />
                </div>
                <div className="reve-card-actions-row">
                  <div className="card-actions-left">
                    <button type="button" className="card-action-icon" title="Attach asset" onClick={() => fileInputRef.current?.click()}>
                      <Paperclip size={13} />
                    </button>
                    <button type="button" className="card-action-icon" title="Mention object (@)" onClick={() => setMaskPrompt(prev => prev + ' @')}>
                      <AtSign size={13} />
                    </button>
                    <button type="button" className="card-action-icon rainbow-icon" title="AI Style Preset">
                      <Sparkles size={13} className="text-purple-grad" />
                    </button>
                  </div>
                  <div className="card-actions-right">
                    <button type="button" className="card-trash-btn" title="Clear mask" onClick={clearMaskCanvas}>
                      <Trash2 size={13} />
                    </button>
                    <button
                      type="button"
                      className="card-submit-btn"
                      title="Apply mask inpaint (0.4 credits)"
                      onClick={handleApplyMaskEdit}
                      disabled={isRendering}
                    >
                      {isRendering ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Reframe Interactive Draggable Crop Overlay & Corner Brackets */}
            {isReframeActive && (
              <div
                className="reframe-crop-overlay-box interactive-crop"
                style={{
                  left: `${cropBounds.x0 * 100}%`,
                  top: `${cropBounds.y0 * 100}%`,
                  width: `${(cropBounds.x1 - cropBounds.x0) * 100}%`,
                  height: `${(cropBounds.y1 - cropBounds.y0) * 100}%`
                }}
              >
                {/* Central move/drag handle */}
                <div
                  className="crop-move-handle"
                  title="Drag to move crop area"
                  onMouseDown={(e) => handleCropHandleMouseDown('move', e)}
                />
                {/* Draggable Corner Bracket Handles */}
                <div className="crop-bracket corner-tl" onMouseDown={(e) => handleCropHandleMouseDown('top-left', e)} />
                <div className="crop-bracket corner-tr" onMouseDown={(e) => handleCropHandleMouseDown('top-right', e)} />
                <div className="crop-bracket corner-bl" onMouseDown={(e) => handleCropHandleMouseDown('bottom-left', e)} />
                <div className="crop-bracket corner-br" onMouseDown={(e) => handleCropHandleMouseDown('bottom-right', e)} />

                {/* Draggable Midpoint Handles */}
                <div className="crop-handle handle-top" onMouseDown={(e) => handleCropHandleMouseDown('top', e)} />
                <div className="crop-handle handle-bottom" onMouseDown={(e) => handleCropHandleMouseDown('bottom', e)} />
                <div className="crop-handle handle-left" onMouseDown={(e) => handleCropHandleMouseDown('left', e)} />
                <div className="crop-handle handle-right" onMouseDown={(e) => handleCropHandleMouseDown('right', e)} />
              </div>
            )}

            {/* Bounding Boxes Overlay */}
            {!isReframeActive && layout && Array.isArray(layout.regions) && (
              <div className="svg-overlay-container">
                {layout.regions.map((reg, idx) => {
                  const matchesSearch = !searchQuery || reg.label.toLowerCase().includes(searchQuery.toLowerCase());
                  if (!matchesSearch) return null;

                  const color = REGION_COLORS[idx % REGION_COLORS.length];
                  const isSelected = selectedRegionIdx === idx;
                  const isHovered = hoveredRegionIdx === idx;
                  const isHighlighted = isSelected || isHovered;

                  const left = `${reg.bbox.x0 * 100}%`;
                  const top = `${reg.bbox.y0 * 100}%`;
                  const width = `${(reg.bbox.x1 - reg.bbox.x0) * 100}%`;
                  const height = `${(reg.bbox.y1 - reg.bbox.y0) * 100}%`;

                  return (
                    <div
                      key={idx}
                      className={`interactive-bbox ${isHighlighted ? 'active' : 'hidden-default'} ${isSelected ? 'selected-resizable' : ''}`}
                      style={{
                        left,
                        top,
                        width,
                        height,
                        borderColor: isHighlighted ? color : 'transparent',
                        borderWidth: isHighlighted ? '2px' : '0px',
                        backgroundColor: isSelected ? `${color}35` : isHovered ? `${color}20` : 'transparent',
                        opacity: isHighlighted ? 1 : 0,
                        pointerEvents: 'auto',
                        cursor: isSelected ? 'move' : 'pointer',
                        zIndex: isSelected ? 30 : isHovered ? 20 : 1
                      }}
                      onMouseDown={(e) => {
                        handleSelectRegion(idx);
                        handleRegionHandleMouseDown('move', idx, e);
                      }}
                      onMouseEnter={() => setHoveredRegionIdx(idx)}
                      onMouseLeave={() => setHoveredRegionIdx(null)}
                    >
                      {isHighlighted && (
                        <div className="bbox-label-tag" style={{ backgroundColor: color }}>
                          <Tag size={9} />
                          <span>{reg.label}</span>
                        </div>
                      )}

                      {isSelected && (
                        <>
                          <span className="corner-dot tl interactive-handle" style={{ backgroundColor: '#ffffff', borderColor: color }} onMouseDown={(e) => handleRegionHandleMouseDown('left-top', idx, e)} />
                          <span className="corner-dot tr interactive-handle" style={{ backgroundColor: '#ffffff', borderColor: color }} onMouseDown={(e) => handleRegionHandleMouseDown('right-top', idx, e)} />
                          <span className="corner-dot bl interactive-handle" style={{ backgroundColor: '#ffffff', borderColor: color }} onMouseDown={(e) => handleRegionHandleMouseDown('left-bottom', idx, e)} />
                          <span className="corner-dot br interactive-handle" style={{ backgroundColor: '#ffffff', borderColor: color }} onMouseDown={(e) => handleRegionHandleMouseDown('right-bottom', idx, e)} />
                          
                          <span className="edge-handle handle-top" onMouseDown={(e) => handleRegionHandleMouseDown('top', idx, e)} />
                          <span className="edge-handle handle-bottom" onMouseDown={(e) => handleRegionHandleMouseDown('bottom', idx, e)} />
                          <span className="edge-handle handle-left" onMouseDown={(e) => handleRegionHandleMouseDown('left', idx, e)} />
                          <span className="edge-handle handle-right" onMouseDown={(e) => handleRegionHandleMouseDown('right', idx, e)} />
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sub-toolbar for Mask Brush Tool Controls */}
          {activeToolbarTool === 'brush' && (
            <div className="brush-sub-toolbar">
              <input
                type="color"
                value={brushColor}
                onChange={(e) => setBrushColor(e.target.value)}
                className="brush-color-swatch"
                title="Brush color"
              />
              <Sliders size={13} />
              <span>Size: {brushSize}px</span>
              <input
                type="range"
                min="5"
                max="80"
                value={brushSize}
                onChange={(e) => setBrushSize(parseInt(e.target.value))}
                className="brush-size-range"
              />
              <input
                type="text"
                placeholder="Describe edits (e.g. add red rose)..."
                value={maskPrompt}
                onChange={(e) => setMaskPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleApplyMaskEdit();
                }}
                className="brush-mask-prompt-input"
              />
              <button
                type="button"
                className="brush-generate-btn"
                onClick={handleApplyMaskEdit}
                disabled={isRendering}
                title="Generate brush edit via Anarchy AI API"
              >
                {isRendering ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                <span>Generate (0.4 cr)</span>
              </button>
              <button type="button" className="brush-clear-btn" onClick={clearMaskCanvas}>
                <Trash2 size={12} /> Clear
              </button>
            </div>
          )}

          {/* Tool 7: Add Image Popup Menu */}
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept="image/*"
            onChange={handleFileUpload}
          />
          {showAddImageMenu && (
            <div className="add-image-menu-popup">
              <button
                type="button"
                className="add-image-item"
                onClick={() => {
                  fileInputRef.current?.click();
                }}
              >
                <Upload size={14} /> Upload files
              </button>
              <button type="button" className="add-image-item" onClick={() => setShowAddImageMenu(false)}>
                <Paperclip size={14} /> Previously attached
              </button>
              <button type="button" className="add-image-item" onClick={() => setShowAddImageMenu(false)}>
                <Camera size={14} /> Take photo
              </button>
            </div>
          )}

          {/* Reve Floating Bottom Toolbar Pill */}
          <div className="reve-floating-toolbar-pill">
            <button
              type="button"
              className={`pill-btn ${activeToolbarTool === 'select' && !isReframeActive ? 'active-red' : ''}`}
              onClick={() => { setActiveToolbarTool('select'); setIsReframeActive(false); setShowAddImageMenu(false); }}
              title="Select Tool"
            >
              <MousePointer size={15} />
            </button>
            <button
              type="button"
              className={`pill-btn ${activeToolbarTool === 'bbox' ? 'active-red' : ''}`}
              onClick={() => { setActiveToolbarTool('bbox'); setIsReframeActive(false); setShowAddImageMenu(false); }}
              title="Bounding Box Marquee (Click & Drag to create box)"
            >
              <SquareDashed size={15} />
            </button>
            <button
              type="button"
              className={`pill-btn ${activeToolbarTool === 'brush' ? 'active-red' : ''}`}
              onClick={() => { setActiveToolbarTool('brush'); setIsReframeActive(false); setShowAddImageMenu(false); }}
              title="Brush / Mask Tool (Paint mask)"
            >
              <PenTool size={15} />
            </button>
            <div className="pill-divider" />
            <button
              type="button"
              className={`pill-btn ${activeToolbarTool === '3d' ? 'active-red' : ''}`}
              onClick={() => { setActiveToolbarTool('3d'); setIsReframeActive(false); setShowAddImageMenu(false); }}
              title="3D Cube Tool (Perspective grid)"
            >
              <Box size={15} />
            </button>
            <button
              type="button"
              className={`pill-btn ${activeToolbarTool === 'text' ? 'active-red' : ''}`}
              onClick={() => { setActiveToolbarTool('text'); setIsReframeActive(false); setShowAddImageMenu(false); }}
              title="Text Tool (Click image to add text)"
            >
              <Type size={15} />
            </button>
            <button
              type="button"
              className={`pill-btn ${activeToolbarTool === 'note' ? 'active-red' : ''}`}
              onClick={() => { setActiveToolbarTool('note'); setIsReframeActive(false); setShowAddImageMenu(false); }}
              title="Note Tool (Click image to add pin note)"
            >
              <FileText size={15} />
            </button>
            <button
              type="button"
              className={`pill-btn ${showAddImageMenu ? 'active-red' : ''}`}
              onClick={() => setShowAddImageMenu(!showAddImageMenu)}
              title="Add Image Options"
            >
              <ImageIcon size={15} />
            </button>
            <div className="pill-divider" />
            <button
              type="button"
              className={`pill-btn ${isReframeActive ? 'active-red' : ''}`}
              onClick={() => { setIsReframeActive(!isReframeActive); setShowAddImageMenu(false); }}
              title={isReframeActive ? "Close reframe" : "Reframe image"}
            >
              <Crop size={15} />
            </button>
          </div>
        </div>

        {/* Right Panel: Styled with Anarchy AI Studio Theme */}
        {isReframeActive ? (
          <div className="layout-layers-panel reve-reframe-side-panel dark-studio">
            <div className="reframe-tab-header">
              <div className="reframe-tabs">
                <button
                  type="button"
                  className={`reframe-tab-btn ${reframeTab === 'reshoot' ? 'active' : ''}`}
                  onClick={() => setReframeTab('reshoot')}
                >
                  Reshoot
                </button>
                <button
                  type="button"
                  className={`reframe-tab-btn ${reframeTab === 'relayout' ? 'active' : ''}`}
                  onClick={() => setReframeTab('relayout')}
                >
                  Relayout
                </button>
              </div>
              <button
                type="button"
                className="reframe-close-btn"
                onClick={() => setIsReframeActive(false)}
                title="Close reframe"
              >
                <X size={16} />
              </button>
            </div>

            {reframeTab === 'reshoot' ? (
              <div className="reframe-tab-body">
                <div className="reframe-field-group">
                  <label className="field-label">Reference image</label>
                  <div className="reframe-select-wrapper">
                    <select
                      value={referenceImageMode}
                      onChange={(e) => setReferenceImageMode(e.target.value)}
                      className="reframe-custom-select"
                    >
                      <option value="As inspiration">As inspiration</option>
                      <option value="Literal">Literal</option>
                      <option value="Style transfer">Style transfer</option>
                    </select>
                    <ChevronDown size={14} className="select-arrow" />
                  </div>
                </div>

                <div className="reframe-field-group" style={{ position: 'relative' }}>
                  <label className="field-label">Aspect ratio</label>
                  <button
                    type="button"
                    className="reframe-ratio-trigger-btn"
                    onClick={() => setShowAspectDropdown(!showAspectDropdown)}
                  >
                    <span>{selectedAspectRatio}</span>
                    <ChevronDown size={14} />
                  </button>

                  {showAspectDropdown && (
                    <div className="reframe-ratio-dropdown-menu">
                      {ASPECT_RATIO_OPTIONS.map((opt) => (
                        <div
                          key={opt.label}
                          className={`ratio-menu-item ${selectedAspectRatio === opt.label ? 'selected' : ''}`}
                          onClick={() => {
                            applyAspectRatioToCrop(opt.label);
                            setShowAspectDropdown(false);
                          }}
                        >
                          <div className="ratio-item-left">
                            <span className="ratio-icon-placeholder" />
                            <span className="ratio-label">{opt.label}</span>
                            {opt.sub && <span className="ratio-sub">· {opt.sub}</span>}
                          </div>
                          {selectedAspectRatio === opt.label && <Check size={14} className="check-icon" />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="reframe-field-group">
                  <div className="scale-label-row">
                    <label className="field-label">Scale</label>
                    <span className="scale-val">{reframeScale.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.05"
                    value={reframeScale}
                    onChange={(e) => setReframeScale(parseFloat(e.target.value))}
                    className="reframe-scale-slider"
                  />
                </div>
              </div>
            ) : (
              <div className="reframe-tab-body relayout-body">
                <div className="relayout-custom-link">
                  <span className="relayout-custom-title">Custom</span>
                  <button type="button" className="add-new-btn">+ Add new</button>
                </div>

                {RELAYOUT_CATEGORIES.map((cat) => (
                  <div key={cat.category} className="relayout-category-section">
                    <span className="category-title">{cat.category}</span>
                    <div className="category-items-list">
                      {cat.items.map((item) => {
                        const isChecked = !!relayoutSelections[item.label];
                        return (
                          <div
                            key={item.label}
                            className={`relayout-item-row ${isChecked ? 'active' : ''}`}
                            onClick={() => toggleRelayoutSelection(item.label)}
                          >
                            <div className="item-left">
                              <span className="relayout-icon-box" />
                              <span className="relayout-label">{item.label}</span>
                              <span className="relayout-sub">· ({item.ratio})</span>
                            </div>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              className="relayout-checkbox"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="layout-panel-footer reframe-footer">
              <button
                type="button"
                className="reframe-cancel-btn"
                onClick={() => setIsReframeActive(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="reframe-apply-btn"
                onClick={handleApplyReframe}
                disabled={isRendering}
              >
                {isRendering ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>{reframeTab === 'reshoot' ? 'Done' : 'Apply'}</span>
                )}
              </button>
            </div>
          </div>
        ) : activeToolbarTool === 'adjust' ? (
          <div className="layout-layers-panel reve-adjustments-panel dark-studio">
            <div className="reframe-tab-header">
              <span className="adjust-panel-title">Adjust</span>
              <button type="button" className="reframe-close-btn" onClick={() => setActiveToolbarTool('select')}>
                <X size={16} />
              </button>
            </div>

            <div className="reframe-tab-body">
              <div className="adjust-field-group">
                <div className="scale-label-row">
                  <label className="field-label">Exposure</label>
                  <span className="scale-val">{adjustments.exposure}</span>
                </div>
                <input
                  type="range" min="-100" max="100" value={adjustments.exposure}
                  onChange={(e) => setAdjustments(prev => ({ ...prev, exposure: parseInt(e.target.value) }))}
                  className="reframe-scale-slider"
                />
              </div>

              <div className="adjust-field-group">
                <div className="scale-label-row">
                  <label className="field-label">Contrast</label>
                  <span className="scale-val">{adjustments.contrast}</span>
                </div>
                <input
                  type="range" min="-100" max="100" value={adjustments.contrast}
                  onChange={(e) => setAdjustments(prev => ({ ...prev, contrast: parseInt(e.target.value) }))}
                  className="reframe-scale-slider"
                />
              </div>

              <div className="adjust-field-group">
                <div className="scale-label-row">
                  <label className="field-label">Highlights</label>
                  <span className="scale-val">{adjustments.highlights}</span>
                </div>
                <input
                  type="range" min="-100" max="100" value={adjustments.highlights}
                  onChange={(e) => setAdjustments(prev => ({ ...prev, highlights: parseInt(e.target.value) }))}
                  className="reframe-scale-slider"
                />
              </div>

              <div className="adjust-field-group">
                <div className="scale-label-row">
                  <label className="field-label">Shadows</label>
                  <span className="scale-val">{adjustments.shadows}</span>
                </div>
                <input
                  type="range" min="-100" max="100" value={adjustments.shadows}
                  onChange={(e) => setAdjustments(prev => ({ ...prev, shadows: parseInt(e.target.value) }))}
                  className="reframe-scale-slider"
                />
              </div>

              <div className="adjust-field-group">
                <div className="scale-label-row">
                  <label className="field-label">Vibrance</label>
                  <span className="scale-val">{adjustments.vibrance}</span>
                </div>
                <input
                  type="range" min="-100" max="100" value={adjustments.vibrance}
                  onChange={(e) => setAdjustments(prev => ({ ...prev, vibrance: parseInt(e.target.value) }))}
                  className="reframe-scale-slider"
                />
              </div>

              <div className="adjust-field-group">
                <div className="scale-label-row">
                  <label className="field-label">Temperature</label>
                  <span className="scale-val">{adjustments.temperature}</span>
                </div>
                <input
                  type="range" min="-100" max="100" value={adjustments.temperature}
                  onChange={(e) => setAdjustments(prev => ({ ...prev, temperature: parseInt(e.target.value) }))}
                  className="reframe-scale-slider"
                />
              </div>

              <div className="adjust-field-group">
                <div className="scale-label-row">
                  <label className="field-label">Tint</label>
                  <span className="scale-val">{adjustments.tint}</span>
                </div>
                <input
                  type="range" min="-100" max="100" value={adjustments.tint}
                  onChange={(e) => setAdjustments(prev => ({ ...prev, tint: parseInt(e.target.value) }))}
                  className="reframe-scale-slider"
                />
              </div>

              <div className="reframe-field-group">
                <label className="field-label">Blend</label>
                <div className="reframe-select-wrapper">
                  <select
                    value={adjustments.blend}
                    onChange={(e) => setAdjustments(prev => ({ ...prev, blend: e.target.value }))}
                    className="reframe-custom-select"
                  >
                    <option value="normal">Normal</option>
                    <option value="multiply">Multiply</option>
                    <option value="screen">Screen</option>
                    <option value="overlay">Overlay</option>
                    <option value="soft-light">Soft Light</option>
                  </select>
                  <ChevronDown size={14} className="select-arrow" />
                </div>
              </div>
            </div>

            <div className="layout-panel-footer adjust-footer">
              <button type="button" className="shuffle-btn" onClick={handleShuffleAdjustments}>
                <Shuffle size={14} /> Shuffle
              </button>
              <button type="button" className="reset-adjust-btn" onClick={handleResetAdjustments}>
                <RotateCcw size={14} /> Reset
              </button>
            </div>
          </div>
        ) : activeToolbarTool === 'text' ? (
          <div className="layout-layers-panel reve-text-panel dark-studio">
            <div className="reframe-tab-header">
              <span className="adjust-panel-title">Text Properties</span>
              <button type="button" className="reframe-close-btn" onClick={() => setActiveToolbarTool('select')}>
                <X size={16} />
              </button>
            </div>

            <div className="reframe-tab-body">
              <div className="reframe-field-group">
                <label className="field-label">Font</label>
                <div className="reframe-select-wrapper">
                  <select className="reframe-custom-select">
                    <option>Anarchy Sans Display</option>
                    <option>Inter</option>
                    <option>Roboto</option>
                    <option>Outfit</option>
                  </select>
                  <ChevronDown size={14} className="select-arrow" />
                </div>
              </div>

              <div className="reframe-field-group">
                <label className="field-label">Style</label>
                <div className="reframe-select-wrapper">
                  <select className="reframe-custom-select">
                    <option>Regular</option>
                    <option>Bold</option>
                    <option>Italic</option>
                  </select>
                  <ChevronDown size={14} className="select-arrow" />
                </div>
              </div>

              <div className="reframe-field-group">
                <label className="field-label">Color</label>
                <input type="color" defaultValue="#ffffff" className="text-color-picker" />
              </div>
            </div>
          </div>
        ) : (
          <div className="layout-layers-panel">
            {/* Website-Style Mode Switcher Header: Edit | Analyzed Scenes */}
            <div className="panel-mode-switcher-bar">
              <div className="mode-tab-group">
                <button
                  type="button"
                  className={`mode-tab-btn ${panelMode === 'edit' ? 'active' : ''}`}
                  onClick={() => setPanelMode('edit')}
                >
                  <Edit3 size={13} />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  className={`mode-tab-btn ${panelMode === 'chat' ? 'active' : ''}`}
                  onClick={() => setPanelMode('chat')}
                >
                  <Layers size={13} />
                  <span>Analyzed Scenes ({combinedAnalyzedScenes.length})</span>
                </button>
              </div>
            </div>

            {panelMode === 'chat' ? (
              <div className="analyzed-scenes-panel-body">
                <div className="scenes-header-info">
                  <div className="scenes-title-row">
                    <Layers size={15} className="text-red" />
                    <span className="scenes-title">Analyzed Scenes Library</span>
                    <span className="scenes-count-badge">{combinedAnalyzedScenes.length} Saved</span>
                  </div>
                  <p className="scenes-desc">
                    All images analyzed with Reve API are permanently saved here. Click any image card below to load its 3D objects and layers into the editor instantly without re-scanning or spending credits.
                  </p>
                </div>

                <div className="scenes-cards-list">
                  {combinedAnalyzedScenes.length === 0 ? (
                    <div className="layout-editor-empty" style={{ padding: '30px 10px' }}>
                      <Layers size={32} className="empty-icon text-red" />
                      <p style={{ marginTop: '10px', fontSize: '12px', color: '#94a3b8' }}>
                        No analyzed scenes saved yet. Analyze any image to store its layout here permanently.
                      </p>
                    </div>
                  ) : (
                    combinedAnalyzedScenes.map((scene, idx) => {
                      const isActive = scene.url === currentTargetImage;
                      return (
                        <AnalyzedSceneCard
                          key={scene.id || idx}
                          scene={scene}
                          isActive={isActive}
                          onSelect={() => {
                            setActiveStageImage(scene.url);
                            if (scene.layout) {
                              setLayout(scene.layout);
                              onLayoutExtracted?.(scene.layout);
                            }
                            setPanelMode('edit');
                          }}
                          onDelete={() => deleteSavedScene(scene.url)}
                        />
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="panel-subtitle">
                  <div className="subtitle-top">
                    <span>Extracted Layers</span>
                    <span className="hint-text">{layout?.regions?.length || 0} objects</span>
                  </div>
                  
                  {layout?.regions && layout.regions.length > 5 && (
                    <div className="layers-search-box">
                      <Search size={12} className="search-icon" />
                      <input
                        type="text"
                        placeholder="Filter objects (e.g. woman, pool)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="layers-search-input"
                      />
                      {searchQuery && (
                        <button type="button" className="clear-search-btn" onClick={() => setSearchQuery('')}>
                          <X size={11} />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="layers-scroll-list">
                  {extractError && !isExtracting && (
                    <div className="layers-empty-state error">
                      <AlertCircle size={22} className="text-red" />
                      <span className="empty-title">Layout Scan Error</span>
                      <small className="empty-desc">{extractError}</small>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        <button type="button" onClick={() => handleExtractLayout(true)} disabled={isExtracting} className="retry-btn">
                          {isExtracting ? <Loader2 size={13} className="animate-spin" /> : null}
                          <span>{isExtracting ? 'Retrying...' : 'Retry Scan'}</span>
                        </button>
                        <button type="button" onClick={() => setShowKeyModal(true)} className="retry-btn" style={{ background: '#f43f5e', color: '#fff', borderColor: '#f43f5e' }}>
                          <Key size={13} />
                          <span>Set API Key</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {(!layout?.regions || layout.regions.length === 0) && !isExtracting && !extractError && (
                    <div className="layers-empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '36px 16px', textAlign: 'center', gap: '14px' }}>
                      <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(225, 29, 72, 0.12)', border: '1px solid rgba(225, 29, 72, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e11d48' }}>
                        <Layers size={26} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span className="empty-title" style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc' }}>
                          Scene Not Analyzed Yet
                        </span>
                        <small className="empty-desc" style={{ fontSize: '12px', color: '#94a3b8', maxWidth: '240px', lineHeight: 1.5 }}>
                          Click "Scan Scene" to extract 3D elements, objects and layers for this image.
                        </small>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleExtractLayout(true)}
                        disabled={isExtracting || !(activeStageImage || displayImage || rawImage)}
                        style={{
                          marginTop: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '10px 20px',
                          borderRadius: '8px',
                          background: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
                          color: '#ffffff',
                          fontWeight: 700,
                          fontSize: '13px',
                          border: 'none',
                          cursor: 'pointer',
                          boxShadow: '0 4px 16px rgba(225, 29, 72, 0.45)',
                          transition: 'transform 0.15s ease'
                        }}
                      >
                        <RefreshCw size={14} className={isExtracting ? 'animate-spin' : ''} />
                        <span>{isExtracting ? 'Scanning...' : 'Scan Scene'}</span>
                        <span style={{ fontSize: '11px', opacity: 0.95, background: 'rgba(0,0,0,0.35)', padding: '2px 6px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Coins size={10} /> {getModelCost('reve/extract-layout')} cr
                        </span>
                      </button>
                    </div>
                  )}

                  {layout?.regions && layout.regions.length > 0 && (
                    <div className="reve-accordion-group">
                      <div
                        className="reve-group-header"
                        onClick={() => setIsGroupExpanded(!isGroupExpanded)}
                      >
                        <div className="reve-group-title">
                          {cropThumbnails[0] ? (
                            <img src={cropThumbnails[0]} alt="Group Thumb" className="reve-group-thumb" />
                          ) : (
                            <div className="reve-group-thumb-placeholder" />
                          )}
                          <span>Generated Image</span>
                        </div>
                        {isGroupExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </div>

                      {isGroupExpanded && (
                        <div className="reve-group-items">
                          {hierarchyTree.map(rootNode => renderTreeItem(rootNode, 0))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Reve-Style Floating Ask Anarchy AI Prompt Box with Single Apply Button */}
            <div className="ask-anarchy-prompt-container">
              <div className="ask-anarchy-input-row">
                <input
                  type="text"
                  className="ask-anarchy-text-input"
                  placeholder="Ask Anarchy AI..."
                  value={askAnarchyPrompt}
                  onChange={(e) => setAskAnarchyPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (askAnarchyPrompt.trim()) {
                        handleSendAskAnarchy();
                      } else {
                        handleApplyEdits();
                      }
                    }
                  }}
                />
              </div>
              <div className="ask-anarchy-tools-row">
                <div className="ask-tools-left">
                  <button
                    type="button"
                    className="ask-tool-btn"
                    title="Attach asset"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip size={14} />
                  </button>
                  <div style={{ position: 'relative' }}>
                    <button
                      type="button"
                      className={`ask-tool-btn ${showMentionMenu ? 'active' : ''}`}
                      title="Mention object (@)"
                      onClick={() => setShowMentionMenu(!showMentionMenu)}
                    >
                      <AtSign size={14} />
                    </button>
                    {showMentionMenu && (
                      <div
                        className="mention-objects-popup dark-studio"
                        style={{
                          position: 'absolute',
                          bottom: '100%',
                          left: 0,
                          marginBottom: '6px',
                          width: '210px',
                          maxHeight: '200px',
                          overflowY: 'auto',
                          background: '#0f172a',
                          border: '1px solid rgba(244,63,94,0.4)',
                          borderRadius: '8px',
                          boxShadow: '0 10px 25px rgba(0,0,0,0.6)',
                          zIndex: 99999,
                          padding: '4px'
                        }}
                      >
                        <div style={{ fontSize: '10px', color: '#94a3b8', padding: '4px 6px', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                          Mention Detected Object
                        </div>
                        {(layout?.regions || []).map((reg, idx) => (
                          <button
                            key={idx}
                            type="button"
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              padding: '6px 8px',
                              background: 'none',
                              border: 'none',
                              color: '#f8fafc',
                              fontSize: '11.5px',
                              cursor: 'pointer',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(244,63,94,0.2)'}
                            onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                            onClick={() => {
                              setAskAnarchyPrompt(prev => `${prev} @${reg.label} `);
                              setShowMentionMenu(false);
                            }}
                          >
                            <Tag size={10} style={{ color: REGION_COLORS[idx % REGION_COLORS.length] }} />
                            <span>{reg.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="ask-tool-btn rainbow-icon"
                    title="AI Style Preset"
                    onClick={() => setAskAnarchyPrompt(prev => prev + ' [Style]')}
                  >
                    <Sparkles size={14} className="text-purple-grad" />
                  </button>
                </div>
                <button
                  type="button"
                  className="ask-anarchy-apply-btn"
                  onClick={() => {
                    if (askAnarchyPrompt.trim()) {
                      handleSendAskAnarchy();
                    } else {
                      handleApplyEdits();
                    }
                  }}
                  disabled={isRendering || isExtracting}
                  title="Apply changes via Anarchy AI (2.1 credits)"
                >
                  {isRendering ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <>
                      <span>Apply</span>
                      <ArrowUp size={13} />
                      <span className="ask-credit-badge">2.1 cr</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Anarchy AI API Key Modal Dialog */}
      {showKeyModal && (
        <div
          className="anarchy-modal-backdrop"
          onClick={() => setShowKeyModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}
        >
          <div
            className="anarchy-key-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ width: '420px', maxWidth: '90vw', background: '#0f172a', border: '1px solid rgba(244,63,94,0.3)', borderRadius: '12px', padding: '20px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: '#fff', fontSize: '15px' }}>
                <Key size={18} style={{ color: '#f43f5e' }} />
                <span>Anarchy AI API Key</span>
              </div>
              <button
                type="button"
                onClick={() => setShowKeyModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '14px', lineHeight: 1.5 }}>
              Enter your Reve / Anarchy AI API Key (`papi...`) to enable interactive scene object extraction, outpainting, and mask editing.
            </p>

            <input
              type="password"
              placeholder="papi.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx..."
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: '13px', fontFamily: 'monospace', outline: 'none' }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '18px' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowKeyModal(false)}
                style={{ padding: '6px 14px', borderRadius: '6px', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '12px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (inputKey.trim()) {
                    localStorage.setItem('anarchy_api_key', inputKey.trim());
                    setShowKeyModal(false);
                    setExtractError(null);
                    handleExtractLayout(true);
                  }
                }}
                style={{ padding: '6px 16px', borderRadius: '6px', background: '#f43f5e', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
              >
                Save & Retry Scan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
