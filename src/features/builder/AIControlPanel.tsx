/**
 * AI Control Panel - Clean Professional Design
 * Tool → Engine → Resolution → Aspect Ratio flow
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  ChevronDown, Check, Wand2, ImagePlus, Maximize2, 
  Film, Zap, Sparkles, Lock,
  Banana,
  Flame, Crown, Star,
  Sprout, Clapperboard, Brain, Layers, Rocket, Globe,
  X, FolderOpen, Volume2
} from 'lucide-react';
import { replicateService, type ReplicateImageModel, type ReplicateUpscaleModel, type ReplicateVideoModel } from '../../services/replicate';
import { useAIConfigStore } from '../../stores/aiConfigStore';
import type { WatermarkPosition } from '../../stores/aiConfigStore';
import './AIControlPanel.css';

interface AIControlPanelProps {
  selectedModel: ReplicateImageModel | ReplicateUpscaleModel | ReplicateVideoModel;
  onModelChange: (model: ReplicateImageModel | ReplicateUpscaleModel | ReplicateVideoModel) => void;
  params: {
    steps: number;
    cfg: number;
    seed: number | null;
    strength: number;
    referenceStrength: number;
    results: number;
    negativePrompt: string;
    disableSafetyChecker: boolean;
    upscaleFactor?: number;
    resolution?: string;
    aspectRatio?: string;
    width?: number;
    height?: number;
    // Watermark settings
    enableWatermark: boolean;
    watermarkText: string;
    watermarkPosition: WatermarkPosition;
    watermarkOpacity: number;
    watermarkFontSize: number;
    // Topaz Labs settings
    enhanceModel?: string;
    topazUpscaleFactor?: string;
    topazSubjectDetection?: string;
    faceEnhancement?: boolean;
    faceEnhancementCreativity?: number;
    faceEnhancementStrength?: number;
    // Clarity Upscaler settings
    clarityScale?: number;
    clarityDynamic?: number;
    clarityCreativity?: number;
    clarityTilingWidth?: number;
    clarityTilingHeight?: number;
    claritySdModel?: string;
    clarityScheduler?: string;
    claritySteps?: number;
    claritySeed?: number | null;
    clarityDownscaling?: boolean;
    clarityDownscalingRes?: number;
    claritySharpen?: number;
    clarityHandfix?: string;
    clarityResemblance?: number;
    clarityOutputFormat?: string;
    // Pruna AI settings
    prunaMode?: 'target' | 'factor';
    prunaTarget?: number;
    prunaFactor?: number;
    prunaEnhanceDetails?: boolean;
    prunaEnhanceRealism?: boolean;
    prunaQuality?: number;
    prunaOutputFormat?: string;
    // Krea AI settings
    kreaCreativity?: 'raw' | 'low' | 'medium' | 'high';
    // Style settings
    styleType?: string;
    stylePreset?: string;
    // Seedream sequential settings
    sequentialImageGeneration?: string;
    maxImages?: number;
    // Video settings
    videoDuration?: string;
    videoQuality?: string;
    motionStrength?: number;
    videoFps?: number;
    // Seedance 2.0 settings
    seedanceLastFrameImage?: string | null;
    seedanceGenerateAudio?: boolean;
    // Kling v3 Omni Video settings
    klingStartImage?: string | null;
    klingEndImage?: string | null;
    klingReferenceImages?: string[] | null;
    klingReferenceVideo?: string | null;
    klingVideoReferenceType?: string;
    klingKeepOriginalSound?: boolean;
    klingGenerateAudio?: boolean;
    klingMode?: string;
    // Pruna video settings
    prunaLastFrameImage?: string | null;
    prunaAudio?: string | null;
    prunaFps?: number;
    // Google Veo settings
    veoLastFrame?: string | null;
    veoGenerateAudio?: boolean;
    // PixVerse v6 settings
    pixverseLastFrameImage?: string | null;
    pixverseGenerateAudioSwitch?: boolean;
    pixverseGenerateMultiClipSwitch?: boolean;
    // OpenAI Sora settings
    soraInputReference?: string | null;
    // Anarchy / Reve postprocessing settings
    anarchyRemoveBackground?: boolean;
    anarchyUpscaleFactor?: 'Off' | '2x' | '3x' | '4x';
    anarchyEffect?: string;
  };
  onParamsChange: (params: AIControlPanelProps['params']) => void;
}

const UPSCALE_FACTORS = [1, 2, 4, 8, 16] as const;

// ── Custom Select Dropdown (replaces native <select>) ────────────────────────
interface PanelSelectOption { value: string | number; label: string; }
interface PanelSelectProps {
  value: string | number;
  options: PanelSelectOption[];
  onChange: (v: string) => void;
  className?: string;
}
const PanelSelect: React.FC<PanelSelectProps> = ({ value, options, onChange, className }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find(o => String(o.value) === String(value)) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, [open]);

  return (
    <div ref={ref} className={`panel-select-wrap ${className ?? ''}`} style={{ position: 'relative' }}>
      <div
        className={`panel-select-trigger ${open ? 'open' : ''}`}
        onClick={() => setOpen(v => !v)}
      >
        <span className="panel-select-val">{selected?.label}</span>
        <ChevronDown size={14} className={`panel-select-arrow ${open ? 'rotated' : ''}`} />
      </div>
      {open && (
        <div className="panel-select-menu">
          {options.map(opt => (
            <div
              key={opt.value}
              className={`panel-select-item ${String(opt.value) === String(value) ? 'active' : ''}`}
              onClick={() => { onChange(String(opt.value)); setOpen(false); }}
            >
              <span>{opt.label}</span>
              {String(opt.value) === String(value) && <Check size={12} color="#e11d48" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface PanelFileSelectorProps {
  label: string;
  value: string | null | undefined;
  accept: string;
  hint?: string;
  placeholder?: string;
  onChange: (url: string | null) => void;
}
const PanelFileSelector: React.FC<PanelFileSelectorProps> = ({
  label,
  value,
  accept,
  hint,
  placeholder = 'Enter a URL, paste a file, or drag a file over...',
  onChange
}) => {
  const isVideo = accept.includes('video');
  const [inputValue, setInputValue] = useState(value || '');

  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        onChange(dataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleInputChange = (val: string) => {
    setInputValue(val);
    onChange(val || null);
  };

  return (
    <div className="control-section" style={{ marginTop: '12px' }}>
      <label className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {isVideo ? <Film size={12} /> : accept.includes('audio') ? <Volume2 size={12} /> : <ImagePlus size={12} />}
        {label}
      </label>
      
      <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder={placeholder}
          style={{
            flex: 1,
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '6px',
            color: '#f8fafc',
            padding: '6px 10px',
            fontSize: '12px',
            outline: 'none',
            transition: 'border-color 0.2s'
          }}
          onFocus={(e) => e.target.style.borderColor = '#e11d48'}
          onBlur={(e) => e.target.style.borderColor = '#334155'}
        />
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            background: '#1e293b',
            border: '1px solid #334155',
            color: '#94a3b8',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          title="Browse local file"
        >
          <FolderOpen size={16} />
          <input
            type="file"
            accept={accept}
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      {value && (
        <div style={{ position: 'relative', marginTop: '8px', borderRadius: '6px', overflow: 'hidden', border: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', padding: '4px' }}>
          {isVideo ? (
            <video
              src={value}
              controls
              style={{ maxHeight: '100px', maxWidth: '100%', borderRadius: '4px' }}
            />
          ) : accept.includes('audio') ? (
            <audio
              src={value}
              controls
              style={{ maxWidth: '100%', borderRadius: '4px' }}
            />
          ) : (
            <img
              src={value}
              alt={label}
              style={{ maxHeight: '100px', objectFit: 'contain', borderRadius: '4px' }}
            />
          )}
          <button
            type="button"
            onClick={() => onChange(null)}
            style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(244,63,94,0.85)', color: '#fff', border: 'none', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
            title="Remove"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {hint && (
        <span className="param-hint" style={{ display: 'block', marginTop: '4px', fontSize: '11px', color: '#64748b' }}>
          {hint}
        </span>
      )}
    </div>
  );
};



// Tool types matching the reference design
type ToolType = 'image-editor' | 'image-creator' | 'image-upscaler' | 'video-creator' | '3d-creator' | 'anarchy-creator';

const TOOLS: { id: ToolType; name: string; icon: React.ReactNode; disabled?: boolean }[] = [
  { id: 'image-editor',   name: 'Image Studio',      icon: <Wand2 size={16} /> },
  { id: 'image-upscaler', name: 'Image Upscaling',   icon: <Maximize2 size={16} /> },
  { id: 'video-creator',  name: 'Video Studio',      icon: <Film size={16} /> },
  { id: 'anarchy-creator', name: 'Anarchy Generation', icon: <Sparkles size={16} />, disabled: true },
];

// Engine/Models definition - supports all model types (image, upscale, video, 3D, chat)
interface Engine {
  id: ReplicateImageModel | ReplicateUpscaleModel | import('../../services/replicate/ReplicateService').ReplicateVideoModel;
  name: string;
  provider: 'Google' | 'BlackForest' | 'Recraft' | 'Together' | 'ByteDance' | 'OpenAI' | 'Replicate' | 'Anarchy AI';
  color: string;
  icon: React.ReactNode;
  tool: ToolType;
  badge?: string;
  /** If true, only shown when studioMode === 'generate' inside image-editor */
  generateOnly?: boolean;
}


const ENGINES: Engine[] = [
  // ── Anarchy Generation (Reve AI v2 Models) ──
  {
    id: 'reve/create' as ReplicateImageModel,
    name: 'Anarchy Create (v2)',
    provider: 'Anarchy AI',
    color: '#e11d48',
    icon: <Sparkles size={18} />,
    tool: 'anarchy-creator',
    badge: 'v2'
  },
  {
    id: 'reve/edit-fast' as ReplicateImageModel,
    name: 'Anarchy Edit Fast',
    provider: 'Anarchy AI',
    color: '#e11d48',
    icon: <Sparkles size={18} />,
    tool: 'anarchy-creator',
    badge: 'Fast'
  },
  {
    id: 'reve/extract-layout' as ReplicateImageModel,
    name: 'Anarchy Analysis (v2)',
    provider: 'Anarchy AI',
    color: '#e11d48',
    icon: <Layers size={18} />,
    tool: 'anarchy-creator',
    badge: 'Layout'
  },
  {
    id: 'reve/create-layout' as ReplicateImageModel,
    name: 'Anarchy Create Layout (v2)',
    provider: 'Anarchy AI',
    color: '#e11d48',
    icon: <Layers size={18} />,
    tool: 'anarchy-creator',
    badge: 'Layout'
  },
  {
    id: 'reve/render-layout' as ReplicateImageModel,
    name: 'Anarchy Render Layout (v2)',
    provider: 'Anarchy AI',
    color: '#e11d48',
    icon: <Layers size={18} />,
    tool: 'anarchy-creator',
    badge: 'Layout'
  },
  {
    id: 'reve/reconcile-layouts' as ReplicateImageModel,
    name: 'Anarchy Reconcile Layouts (v2)',
    provider: 'Anarchy AI',
    color: '#e11d48',
    icon: <Layers size={18} />,
    tool: 'anarchy-creator',
    badge: 'Layout'
  },
  {
    id: 'prunaai/p-image',
    name: 'Pruna P-Image',
    provider: 'Replicate',
    color: '#8b5cf6',
    icon: <Zap size={18} />,
    tool: 'anarchy-creator',
    badge: 'Fast'
  },
  {
    id: 'krea/krea-2-large',
    name: 'Krea 2 Large',
    provider: 'Replicate',
    color: '#ec4899',
    icon: <Sparkles size={18} />,
    tool: 'anarchy-creator',
    badge: 'Pro'
  },
  // ── Video Generation (7 models) ──
  {
    id: 'bytedance/seedance-2.0',
    name: 'Seedance 2.0',
    provider: 'ByteDance',
    color: '#3b82f6',
    icon: <Sprout size={18} />,
    tool: 'video-creator',
    badge: 'Fast'
  },
  {
    id: 'kwaivgi/kling-v3-omni-video',
    name: 'Kling v3 Omni Video',
    provider: 'Together',
    color: '#ef4444',
    icon: <Clapperboard size={18} />,
    tool: 'video-creator',
    badge: 'Pro'
  },
  {
    id: 'xai/grok-imagine-video-1.5',
    name: 'Grok Imagine Video 1.5',
    provider: 'Replicate',
    color: '#10b981',
    icon: <Brain size={18} />,
    tool: 'video-creator'
  },
  {
    id: 'prunaai/p-video',
    name: 'Pruna AI P-Video',
    provider: 'Replicate',
    color: '#8b5cf6',
    icon: <Layers size={18} />,
    tool: 'video-creator'
  },
  {
    id: 'google/veo-3.1-fast',
    name: 'Google Veo 3.1 Fast',
    provider: 'Google',
    color: '#f59e0b',
    icon: <Rocket size={18} />,
    tool: 'video-creator',
    badge: '3.1 Fast'
  },
  {
    id: 'pixverse/pixverse-v6',
    name: 'PixVerse v6',
    provider: 'Replicate',
    color: '#ec4899',
    icon: <Globe size={18} />,
    tool: 'video-creator'
  },
  {
    id: 'openai/sora-2-pro',
    name: 'Sora 2 Pro',
    provider: 'OpenAI',
    color: '#06b6d4',
    icon: <Crown size={18} />,
    tool: 'video-creator',
    badge: 'Pro'
  },
  // ── Image Editing (7 models in requested order) ──
  {
    id: 'google/nano-banana-2',
    name: 'Nano Banana 2',
    provider: 'Google',
    color: '#e11d48',
    icon: <Banana size={18} />,
    tool: 'image-editor',
    badge: 'New'
  },
  {
    id: 'google/nano-banana-2-lite',
    name: 'Nano Banana 2 Lite',
    provider: 'Google',
    color: '#e11d48',
    icon: <Banana size={18} />,
    tool: 'image-editor',
    badge: 'Lite'
  },
  {
    id: 'bytedance/seedream-5-pro',
    name: 'Seedream 5 Pro',
    provider: 'ByteDance',
    color: '#e11d48',
    icon: <Zap size={18} />,
    tool: 'image-editor',
    badge: 'Pro'
  },
  {
    id: 'black-forest-labs/flux-2-pro',
    name: 'FLUX 2 Pro',
    provider: 'BlackForest',
    color: '#e11d48',
    icon: <Flame size={18} />,
    tool: 'image-editor',
    badge: '8 Refs'
  },
  {
    id: 'openai/gpt-image-2',
    name: 'GPT Image 2',
    provider: 'OpenAI',
    color: '#e11d48',
    icon: <Star size={18} />,
    tool: 'image-editor'
  },
  {
    id: 'google/nano-banana-pro',
    name: 'Nano Banana Pro',
    provider: 'Google',
    color: '#e11d48',
    icon: <Crown size={18} />,
    tool: 'image-editor',
    badge: 'Pro'
  },
  {
    id: 'prunaai/p-image',
    name: 'Pruna P-Image',
    provider: 'Replicate',
    color: '#8b5cf6',
    icon: <Zap size={18} />,
    tool: 'image-editor',
    badge: 'Fast',
    generateOnly: true
  },
  {
    id: 'krea/krea-2-large',
    name: 'Krea 2 Large',
    provider: 'Replicate',
    color: '#ec4899',
    icon: <Sparkles size={18} />,
    tool: 'image-editor',
    badge: 'Pro',
    generateOnly: true
  },
  // ── Image Upscaling ──
  {
    id: 'topazlabs/image-upscale' as ReplicateImageModel,
    name: 'Topaz Labs Upscale',
    provider: 'Replicate',
    color: '#e11d48',
    icon: <Maximize2 size={18} />,
    tool: 'image-upscaler'
  },

  {
    id: 'philz1337x/clarity-upscaler' as ReplicateImageModel,
    name: 'Clarity Upscaler',
    provider: 'Replicate',
    color: '#e11d48',
    icon: <Sparkles size={18} />,
    tool: 'image-upscaler'
  },
  {
    id: 'prunaai/p-image-upscale' as ReplicateImageModel,
    name: 'Pruna AI Upscale',
    provider: 'Replicate',
    color: '#e11d48',
    icon: <Maximize2 size={18} />,
    tool: 'image-upscaler'
  },
];

export const AIControlPanel: React.FC<AIControlPanelProps> = ({
  selectedModel,
  onModelChange,
  params,
  onParamsChange
}) => {
  const config = useAIConfigStore((state) => state.config);
  const setConfig = useAIConfigStore((state) => state.setConfig);
  
  // Initialize selectedTool from config, but only once on mount
  const initialToolRef = useRef<ToolType>(config.selectedTool || 'image-editor');
  const [selectedTool, setSelectedTool] = useState<ToolType>(initialToolRef.current);
  const [showToolDropdown, setShowToolDropdown] = useState(false);
  const [showEngineDropdown, setShowEngineDropdown] = useState(false);
  const [showResDropdown, setShowResDropdown] = useState(false);
  const [showAspectDropdown, setShowAspectDropdown] = useState(false);
  const [showStyleTypeDropdown, setShowStyleTypeDropdown] = useState(false);
  const [showStylePresetDropdown, setShowStylePresetDropdown] = useState(false);
  const [showSeqDropdown, setShowSeqDropdown] = useState(false);

  // Ref to track previous tool value
  const prevSelectedToolRef = useRef<ToolType>(selectedTool);
  
  // Sync external config changes to local state (when config changes from outside)
  useEffect(() => {
    if (config.selectedTool !== selectedTool) {
      setSelectedTool(config.selectedTool);
      prevSelectedToolRef.current = config.selectedTool;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only react to external config changes, not local selectedTool state
  }, [config.selectedTool]);
  
  // Sync selectedTool to AIConfigContext - only when local tool changes
  useEffect(() => {
    if (prevSelectedToolRef.current !== selectedTool) {
      prevSelectedToolRef.current = selectedTool;
      setConfig(prev => ({ ...prev, selectedTool }));
    }
  }, [selectedTool, setConfig]);

  // Ensure active model is a Reve model when anarchy-creator is selected
  useEffect(() => {
    if (selectedTool === 'anarchy-creator' && !selectedModel.startsWith('reve/')) {
      onModelChange('reve/create');
    }
  }, [selectedTool, selectedModel, onModelChange]);

  // Refs for dropdown containers
  const toolDropdownRef = useRef<HTMLDivElement>(null);
  const engineDropdownRef = useRef<HTMLDivElement>(null);
  const resDropdownRef = useRef<HTMLDivElement>(null);
  const aspectDropdownRef = useRef<HTMLDivElement>(null);
  const styleTypeDropdownRef = useRef<HTMLDivElement>(null);
  const stylePresetDropdownRef = useRef<HTMLDivElement>(null);
  const seqDropdownRef = useRef<HTMLDivElement>(null);
  const studioModeForFilter = config.studioMode || 'edit';
  const availableEngines = useMemo(() => {
    return ENGINES.filter(engine => {
      if (engine.tool !== selectedTool) return false;
      // In IMAGE STUDIO, Edit mode hides generateOnly models, while Generate mode shows all models
      if (selectedTool === 'image-editor' && studioModeForFilter === 'edit' && engine.generateOnly) {
        return false;
      }
      return true;
    });
  }, [selectedTool, studioModeForFilter]);

  const selectedEngine = availableEngines.find(e => e.id === selectedModel) || availableEngines[0] || ENGINES[0];
  
  // Get model-specific settings
  const modelSettings = useMemo(() => replicateService.getModelSettings(selectedModel), [selectedModel]);
  
  // Filter available resolutions and aspect ratios based on model
  const availableResolutions = modelSettings.resolutions;
  const availableAspectRatios = modelSettings.aspectRatios;

  // Auto-adjust params when model changes
  useEffect(() => {
    const updates: Partial<typeof params> = {};
    
    // Check if current resolution is supported
    if (params.resolution && !availableResolutions.includes(params.resolution)) {
      updates.resolution = availableResolutions[0] ?? 'Auto';
    }
    
    // Check if current aspect ratio is supported
    if (params.aspectRatio && !availableAspectRatios.includes(params.aspectRatio)) {
      updates.aspectRatio = availableAspectRatios[0] ?? '1:1';
    }

    // Auto-correct video duration for Seedance 2.0
    if (selectedModel === 'bytedance/seedance-2.0') {
      const dur = params.videoDuration != null ? Number(String(params.videoDuration).replace('s', '')) : 5;
      if (dur !== -1 && (dur < 4 || dur > 15)) {
        updates.videoDuration = '5';
      }
    }
    
    // Apply updates if needed
    if (Object.keys(updates).length > 0) {
      onParamsChange({ ...params, ...updates });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: params excluded to avoid infinite update loop (object identity changes every render)
  }, [selectedModel, availableResolutions, availableAspectRatios, modelSettings, onParamsChange]);

  // Only auto-switch model when tool changes, not on every render
  const selectedModelRef = useRef(selectedModel);
  selectedModelRef.current = selectedModel;
  
  useEffect(() => {
    // Only change model if current model is not available in current availableEngines list
    if (availableEngines.length > 0 && !availableEngines.some(engine => engine.id === selectedModelRef.current)) {
      onModelChange(availableEngines[0].id as ReplicateImageModel | ReplicateUpscaleModel | ReplicateVideoModel);
    }
  }, [selectedTool, availableEngines, onModelChange]);

  // Close dropdowns when clicking outside (including canvas)
  useEffect(() => {
    const closeAll = () => {
      setShowToolDropdown(false);
      setShowEngineDropdown(false);
      setShowResDropdown(false);
      setShowAspectDropdown(false);
      setShowStyleTypeDropdown(false);
      setShowStylePresetDropdown(false);
      setShowSeqDropdown(false);
    };

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const insideAny = (
        (toolDropdownRef.current?.contains(target)) ||
        (engineDropdownRef.current?.contains(target)) ||
        (resDropdownRef.current?.contains(target)) ||
        (aspectDropdownRef.current?.contains(target)) ||
        (styleTypeDropdownRef.current?.contains(target)) ||
        (stylePresetDropdownRef.current?.contains(target)) ||
        (seqDropdownRef.current?.contains(target))
      );
      if (!insideAny) closeAll();
    };

    document.addEventListener('mousedown', handleClickOutside, true);
    document.addEventListener('click', handleClickOutside, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('click', handleClickOutside, true);
    };
  }, []);

  const updateParam = (key: keyof typeof params, value: any) => {
    onParamsChange({ ...params, [key]: value });
  };

  const isUpscalingTool = selectedTool === 'image-upscaler';
  // Models with variable upscale factors
  const supportsUpscaleFactor = (selectedModel as string) === 'prunaai/p-image-upscale';     // 1x, 2x, 4x, 8x, 16x

  const studioMode = config.studioMode || 'edit';

  return (
    <div className="ai-control-v2">
      {/* Studio Mode Toggle (Edit vs Generate) - IMAGE STUDIO only */}
      {selectedTool === 'image-editor' && (
        <div className="studio-mode-toggle">
          <button
            type="button"
            className={`mode-toggle-btn ${studioMode === 'edit' ? 'active' : ''}`}
            onClick={() => setConfig(prev => ({ ...prev, studioMode: 'edit' }))}
          >
            <Wand2 size={14} />
            <span>Edit</span>
          </button>
          <button
            type="button"
            className={`mode-toggle-btn ${studioMode === 'generate' ? 'active' : ''}`}
            onClick={() => setConfig(prev => ({ ...prev, studioMode: 'generate' }))}
          >
            <Sparkles size={14} />
            <span>Generate</span>
          </button>
        </div>
      )}

      {/* Tool Selector - Main Dropdown */}
      <div className="control-section tool-section" ref={toolDropdownRef}>
        <div 
          className="main-dropdown"
          onClick={() => setShowToolDropdown(!showToolDropdown)}
        >
          <div className="dropdown-left">
            {TOOLS.find(t => t.id === selectedTool)?.icon}
            <span className="dropdown-label">
              {TOOLS.find(t => t.id === selectedTool)?.name}
            </span>
          </div>
          <ChevronDown 
            size={18} 
            className={`dropdown-arrow ${showToolDropdown ? 'open' : ''}`}
          />
        </div>

        {/* Tool Dropdown Menu */}
        {showToolDropdown && (
          <div className="dropdown-menu">
            {TOOLS.map(tool => (
              <div 
                key={tool.id}
                className={`dropdown-item ${selectedTool === tool.id ? 'active' : ''} ${tool.disabled ? 'disabled' : ''}`}
                onClick={() => {
                  if (tool.disabled) return;
                  setSelectedTool(tool.id);
                  const enginesForTool = ENGINES.filter(e => e.tool === tool.id);
                  if (enginesForTool.length > 0 && !enginesForTool.some(e => e.id === selectedModel)) {
                    onModelChange(enginesForTool[0].id);
                  }
                  setShowEngineDropdown(false);
                  setShowToolDropdown(false);
                }}
              >
                {tool.icon}
                <span className="tool-name">{tool.name}</span>
                {tool.disabled 
                  ? (
                    <span className="coming-soon" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(255, 255, 255, 0.06)', color: 'rgba(255, 255, 255, 0.6)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                      Coming soon
                    </span>
                  )
                  : selectedTool === tool.id && <Check size={14} />
                }
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Engine Section */}
      <div className="control-section engine-section" ref={engineDropdownRef}>
        <label className="section-label">Engine</label>
        
        <div 
          className="engine-selector"
          onClick={() => setShowEngineDropdown(!showEngineDropdown)}
        >
          <div className="engine-left">
            <div 
              className="engine-icon" 
              style={{ color: selectedEngine.color }}
            >
              {selectedEngine.icon}
            </div>
            <div className="engine-info">
              <span className="engine-name">{selectedEngine.name}</span>
            </div>
          </div>
          <ChevronDown 
            size={18} 
            className={`dropdown-arrow ${showEngineDropdown ? 'open' : ''}`}
          />
        </div>

        {/* Engine Dropdown */}
        {showEngineDropdown && (
          <div className="dropdown-menu engine-menu">
            {availableEngines.map(engine => (
              <div 
                key={engine.id}
                className={`dropdown-item engine-item ${selectedModel === engine.id ? 'active' : ''}`}
                onClick={() => {
                  onModelChange(engine.id as ReplicateImageModel | ReplicateUpscaleModel | ReplicateVideoModel);
                  setShowEngineDropdown(false);
                }}
              >
                <div 
                  className="engine-icon-small" 
                  style={{ color: engine.color }}
                >
                  {engine.icon}
                </div>
                <span className="engine-item-name">{engine.name}</span>
                {engine.badge && (
                  <span className="engine-item-badge">{engine.badge}</span>
                )}
                {selectedModel === engine.id && (
                  <Check size={14} color="#e11d48" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {isUpscalingTool ? (
        <>
          {(selectedModel as string) !== 'topazlabs/image-upscale' &&
           (selectedModel as string) !== 'philz1337x/clarity-upscaler' && (
            <div className="control-section">
              <label className="section-label">Upscale Factor</label>
              {supportsUpscaleFactor ? (
                <div className="upscale-factor-row">
                  {UPSCALE_FACTORS.map(factor => {
                    // Pruna AI: auto-preset settings per scale factor
                    const isPruna = (selectedModel as string) === 'prunaai/p-image-upscale';
                    const prunaPresets: Record<number, Partial<typeof params>> = {
                      1:  { upscaleFactor: 1,  prunaMode: 'factor', prunaFactor: 1,  prunaEnhanceDetails: false, prunaEnhanceRealism: false, prunaQuality: 80 },
                      2:  { upscaleFactor: 2,  prunaMode: 'factor', prunaFactor: 2,  prunaEnhanceDetails: false, prunaEnhanceRealism: true,  prunaQuality: 80 },
                      4:  { upscaleFactor: 4,  prunaMode: 'factor', prunaFactor: 4,  prunaEnhanceDetails: true,  prunaEnhanceRealism: true,  prunaQuality: 85 },
                      8:  { upscaleFactor: 8,  prunaMode: 'factor', prunaFactor: 8,  prunaEnhanceDetails: true,  prunaEnhanceRealism: true,  prunaQuality: 90 },
                      16: { upscaleFactor: 16, prunaMode: 'target', prunaTarget: 128, prunaEnhanceDetails: true, prunaEnhanceRealism: true,  prunaQuality: 95 },
                    };
                    return (
                      <button
                        key={factor}
                        type="button"
                        className={`upscale-factor-btn ${(params.upscaleFactor ?? 2) === factor ? 'active' : ''}`}
                        onClick={() => {
                          if (isPruna) {
                            const preset = prunaPresets[factor];
                            onParamsChange({ ...params, ...preset });
                          } else {
                            updateParam('upscaleFactor', factor);
                          }
                        }}
                      >
                        {factor}x
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="upscale-fixed-note">This engine uses a fixed upscale level.</div>
              )}
            </div>
          )}
          
          {/* Clarity Upscaler Advanced Settings */}
          {(selectedModel as string) === 'philz1337x/clarity-upscaler' && (
            <>
              {/* Scale Factor - Clarity specific with auto-presets */}
              <div className="control-section">
                <label className="section-label">Clarity Scale</label>
                <div className="upscale-factor-row">
                  {[2, 4, 8, 12].map(factor => {
                    const presets: Record<number, Partial<typeof params>> = {
                      2:  { clarityScale: 2,  clarityDynamic: 6,  clarityCreativity: 0.35, clarityResemblance: 0.6,  clarityTilingWidth: 112, clarityTilingHeight: 144, claritySteps: 18, claritySharpen: 0, clarityDownscaling: false },
                      4:  { clarityScale: 4,  clarityDynamic: 6,  clarityCreativity: 0.35, clarityResemblance: 0.6,  clarityTilingWidth: 96,  clarityTilingHeight: 112, claritySteps: 20, claritySharpen: 0, clarityDownscaling: false },
                      8:  { clarityScale: 8,  clarityDynamic: 8,  clarityCreativity: 0.4,  clarityResemblance: 0.8,  clarityTilingWidth: 64,  clarityTilingHeight: 80,  claritySteps: 25, claritySharpen: 2, clarityDownscaling: false },
                      12: { clarityScale: 12, clarityDynamic: 9,  clarityCreativity: 0.45, clarityResemblance: 1.0, clarityTilingWidth: 48,  clarityTilingHeight: 64,  claritySteps: 30, claritySharpen: 3, clarityDownscaling: false },
                    };
                    return (
                      <button
                        key={factor}
                        type="button"
                        className={`upscale-factor-btn ${(params.clarityScale ?? 2) === factor ? 'active' : ''}`}
                        onClick={() => onParamsChange({ ...params, ...presets[factor] })}
                      >
                        {factor}x
                      </button>
                    );
                  })}
                </div>
                <span className="param-hint">Auto-adjusts settings · 8x=8K · 12x=12K</span>
              </div>
              
              {/* Dynamic - HDR */}
              <div className="control-section">
                <div className="param-header">
                  <label className="section-label">Dynamic (HDR)</label>
                  <span className="param-value">{params.clarityDynamic ?? 6}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={params.clarityDynamic ?? 6}
                  onChange={(e) => updateParam('clarityDynamic', Number.parseInt(e.target.value))}
                  className="param-slider"
                />
                <span className="param-hint">HDR effect, try 3-9</span>
              </div>
              
              {/* Creativity */}
              <div className="control-section">
                <div className="param-header">
                  <label className="section-label">Creativity</label>
                  <span className="param-value">{(params.clarityCreativity ?? 0.35).toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={params.clarityCreativity ?? 0.35}
                  onChange={(e) => updateParam('clarityCreativity', Number.parseFloat(e.target.value))}
                  className="param-slider"
                />
                <span className="param-hint">Try 0.3 - 0.9</span>
              </div>
              
              {/* Tiling */}
              <div className="control-row">
                <div className="control-half">
                  <label className="section-label">Tiling Width</label>
                  <PanelSelect
                    value={params.clarityTilingWidth ?? 112}
                    options={[64,80,96,112,128,144,160].map(v => ({ value: v, label: String(v) }))}
                    onChange={(v) => updateParam('clarityTilingWidth', Number.parseInt(v))}
                  />
                  <span className="param-hint">Lower = more fractality</span>
                </div>
                <div className="control-half">
                  <label className="section-label">Tiling Height</label>
                  <PanelSelect
                    value={params.clarityTilingHeight ?? 144}
                    options={[64,80,96,112,128,144,160].map(v => ({ value: v, label: String(v) }))}
                    onChange={(v) => updateParam('clarityTilingHeight', Number.parseInt(v))}
                  />
                  <span className="param-hint">Lower = more fractality</span>
                </div>
              </div>
              
              {/* SD Model & Scheduler */}
              <div className="control-row">
                <div className="control-half">
                  <label className="section-label">SD Model</label>
                  <PanelSelect
                    value={params.claritySdModel ?? 'juggernaut_reborn.safetensors [338b85bc4f]'}
                    options={[
                      { value: 'juggernaut_reborn.safetensors [338b85bc4f]',          label: 'Juggernaut Reborn' },
                      { value: 'epicrealism_naturalSinRC1VAE.safetensors [84d76a0328]', label: 'Epic Realism' },
                      { value: 'flat2DAnimerge_v45Sharp.safetensors',                  label: 'Flat 2D Animerge' },
                    ]}
                    onChange={(v) => updateParam('claritySdModel', v)}
                  />
                </div>
                <div className="control-half">
                  <label className="section-label">Scheduler</label>
                  <PanelSelect
                    value={params.clarityScheduler ?? 'DPM++ 3M SDE Karras'}
                    options={[
                      { value: 'DPM++ 3M SDE Karras', label: 'DPM++ 3M SDE' },
                      { value: 'DPM++ 2M Karras',     label: 'DPM++ 2M' },
                      { value: 'Euler a',              label: 'Euler a' },
                      { value: 'DDIM',                 label: 'DDIM' },
                    ]}
                    onChange={(v) => updateParam('clarityScheduler', v)}
                  />
                </div>
              </div>
              
              {/* Inference Steps */}
              <div className="control-section">
                <div className="param-header">
                  <label className="section-label">Inference Steps</label>
                  <span className="param-value">{params.claritySteps ?? 18}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={params.claritySteps ?? 18}
                  onChange={(e) => updateParam('claritySteps', Number.parseInt(e.target.value))}
                  className="param-slider"
                />
                <span className="param-hint">Denoising steps</span>
              </div>
              
              {/* Seed */}
              <div className="control-section">
                <label className="section-label">Seed (Optional)</label>
                <div className="seed-row">
                  <input
                    type="number"
                    className="param-input seed-input"
                    placeholder="Random (default 1337)"
                    value={params.claritySeed || ''}
                    onChange={(e) => updateParam('claritySeed', e.target.value ? Number.parseInt(e.target.value) : null)}
                  />
                  <button
                    type="button"
                    className="random-seed-btn"
                    onClick={() => updateParam('claritySeed', Math.floor(Math.random() * 1000000))}
                    title="Random seed"
                  >
                    🎲
                  </button>
                </div>
                <span className="param-hint">Default: 1337</span>
              </div>
              
              {/* Downscaling */}
              <div className="control-section">
                <div className="checkbox-row">
                  <input
                    type="checkbox"
                    id="downscaling"
                    checked={params.clarityDownscaling || false}
                    onChange={(e) => updateParam('clarityDownscaling', e.target.checked)}
                  />
                  <label htmlFor="downscaling" className="checkbox-label">
                    Downscaling
                  </label>
                </div>
                <span className="param-hint">Downscale before upscaling for quality/speed</span>
              </div>
              
              {/* Downscaling Resolution */}
              {params.clarityDownscaling && (
                <div className="control-section">
                  <label className="section-label">Downscale Resolution</label>
                  <input
                    type="number"
                    className="param-input"
                    value={params.clarityDownscalingRes ?? 768}
                    onChange={(e) => updateParam('clarityDownscalingRes', Number.parseInt(e.target.value))}
                    min="256"
                    max="2048"
                    step="64"
                  />
                  <span className="param-hint">Target resolution before upscaling</span>
                </div>
              )}
              
              {/* Sharpen */}
              <div className="control-section">
                <div className="param-header">
                  <label className="section-label">Sharpen</label>
                  <span className="param-value">{params.claritySharpen ?? 0}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={params.claritySharpen ?? 0}
                  onChange={(e) => updateParam('claritySharpen', Number.parseInt(e.target.value))}
                  className="param-slider"
                />
                <span className="param-hint">0 = no sharpening</span>
              </div>
              
              {/* Hand Fix */}
              <div className="control-section">
                <label className="section-label">Hand Fix</label>
                <PanelSelect
                  value={params.clarityHandfix ?? 'disabled'}
                  options={[
                    { value: 'disabled',         label: 'Disabled' },
                    { value: 'hands_only',       label: 'Hands Only' },
                    { value: 'image_and_hands',  label: 'Image & Hands' },
                  ]}
                  onChange={(v) => updateParam('clarityHandfix', v)}
                />
                <span className="param-hint">Use clarity to fix hands</span>
              </div>
              
              {/* Resemblance */}
              <div className="control-section">
                <label className="section-label">Resemblance: {(params.clarityResemblance ?? 0.6).toFixed(1)}</label>
                <input
                  type="range"
                  min="0"
                  max="3"
                  step="0.1"
                  value={params.clarityResemblance ?? 0.6}
                  onChange={(e) => updateParam('clarityResemblance', Number.parseFloat(e.target.value))}
                  className="param-slider"
                />
                <span className="param-hint">0.3 – 1.6 recommended</span>
              </div>

              {/* Output Format */}
              <div className="control-section">
                <label className="section-label">Output Format</label>
                <div className="upscale-factor-row">
                  {(['png', 'jpg', 'webp'] as const).map(f => (
                    <button
                      key={f}
                      type="button"
                      className={`upscale-factor-btn ${(params.clarityOutputFormat ?? 'png') === f ? 'active' : ''}`}
                      onClick={() => updateParam('clarityOutputFormat', f)}
                    >
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Enhancement Prompt */}
              <div className="control-section">
                <label className="section-label">Enhancement Prompt (Optional)</label>
                <input
                  type="text"
                  className="param-input"
                  placeholder="Describe how to enhance the image..."
                  value={params.negativePrompt || ''}
                  onChange={(e) => updateParam('negativePrompt', e.target.value)}
                />
                <span className="param-hint">Guides the AI on how to improve details</span>
              </div>
            </>
          )}
          
          {/* Topaz Labs Advanced Settings */}
          {(selectedModel as string) === 'topazlabs/image-upscale' && (
            <>
              {/* Upscale Factor */}
              <div className="control-section">
                <label className="section-label">Upscale Factor</label>
                <div className="upscale-factor-row">
                  {(['None', '2x', '4x', '6x'] as const).map(f => (
                    <button
                      key={f}
                      type="button"
                      className={`upscale-factor-btn ${(params.topazUpscaleFactor ?? '4x') === f ? 'active' : ''}`}
                      onClick={() => updateParam('topazUpscaleFactor', f)}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <span className="param-hint">How much to upscale the image</span>
              </div>

              {/* Enhance Model */}
              <div className="control-section">
                <label className="section-label">Enhance Model</label>
                <PanelSelect
                  value={params.enhanceModel || 'Low Resolution V2'}
                  options={[
                    { value: 'Low Resolution V2', label: 'Low Resolution V2' },
                    { value: 'Standard V2',        label: 'Standard V2' },
                    { value: 'CGI',                label: 'CGI' },
                    { value: 'High Fidelity V2',   label: 'High Fidelity V2' },
                    { value: 'Text Refine',        label: 'Text Refine' },
                  ]}
                  onChange={(v) => updateParam('enhanceModel', v)}
                />
                <span className="param-hint">AI model for enhancement style</span>
              </div>

              {/* Subject Detection */}
              <div className="control-section">
                <label className="section-label">Subject Detection</label>
                <PanelSelect
                  value={params.topazSubjectDetection || 'None'}
                  options={[
                    { value: 'None',       label: 'None' },
                    { value: 'All',        label: 'All' },
                    { value: 'Foreground', label: 'Foreground' },
                    { value: 'Background', label: 'Background' },
                  ]}
                  onChange={(v) => updateParam('topazSubjectDetection', v)}
                />
                <span className="param-hint">Optimize enhancement for subject type</span>
              </div>
              
              {/* Face Enhancement */}
              <div className="control-section">
                <div className="checkbox-row">
                  <input
                    type="checkbox"
                    id="face-enhancement"
                    checked={params.faceEnhancement || false}
                    onChange={(e) => updateParam('faceEnhancement', e.target.checked)}
                  />
                  <label htmlFor="face-enhancement" className="checkbox-label">
                    Face Enhancement
                  </label>
                </div>
                <span className="param-hint">Enhance faces in the image</span>
              </div>
              
              {/* Face Enhancement Creativity */}
              {params.faceEnhancement && (
                <div className="control-section">
                  <div className="param-header">
                    <label className="section-label">Face Creativity</label>
                    <span className="param-value">{params.faceEnhancementCreativity ?? 0}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={params.faceEnhancementCreativity ?? 0}
                    onChange={(e) => updateParam('faceEnhancementCreativity', Number.parseFloat(e.target.value))}
                    className="param-slider"
                  />
                  <span className="param-hint">Level of creativity for face enhancement (0-1)</span>
                </div>
              )}
              
              {/* Face Enhancement Strength */}
              {params.faceEnhancement && (
                <div className="control-section">
                  <div className="param-header">
                    <label className="section-label">Face Strength</label>
                    <span className="param-value">{params.faceEnhancementStrength ?? 0.8}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={params.faceEnhancementStrength ?? 0.8}
                    onChange={(e) => updateParam('faceEnhancementStrength', Number.parseFloat(e.target.value))}
                    className="param-slider"
                  />
                  <span className="param-hint">Sharpness of enhanced faces relative to background</span>
                </div>
              )}
            </>
          )}
          
          {/* Pruna AI Advanced Settings */}
          {(selectedModel as string) === 'prunaai/p-image-upscale' && (
            <>
              {/* Upscale Mode */}
              <div className="control-section">
                <label className="section-label">Upscale Mode</label>
                <PanelSelect
                  value={params.prunaMode ?? 'target'}
                  options={[
                    { value: 'target', label: 'Target (Megapixels)' },
                    { value: 'factor', label: 'Factor (Multiplier)' },
                  ]}
                  onChange={(v) => updateParam('prunaMode', v)}
                />
                <span className="param-hint">
                  {params.prunaMode === 'target' 
                    ? "Scale to fixed megapixel resolution" 
                    : "Multiply each side by factor"}
                </span>
              </div>
              
              {/* Target Resolution (when mode is 'target') */}
              {params.prunaMode === 'target' && (
                <div className="control-section">
                  <div className="param-header">
                    <label className="section-label">Target Resolution</label>
                    <span className="param-value">{params.prunaTarget ?? 4} MP</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="128"
                    step="1"
                    value={params.prunaTarget ?? 4}
                    onChange={(e) => updateParam('prunaTarget', Number.parseInt(e.target.value))}
                    className="param-slider"
                  />
                  <span className="param-hint">Target resolution in megapixels (1–128 MP)</span>
                </div>
              )}
              
              {/* Factor (when mode is 'factor') */}
              {params.prunaMode !== 'target' && (
                <div className="control-section">
                  <div className="param-header">
                    <label className="section-label">Scale Factor</label>
                    <span className="param-value">{params.prunaFactor ?? 2}x</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="8"
                    value={params.prunaFactor ?? 2}
                    onChange={(e) => updateParam('prunaFactor', Number.parseInt(e.target.value))}
                    className="param-slider"
                  />
                  <span className="param-hint">Scaling factor per side</span>
                </div>
              )}
              
              {/* Output Quality */}
              <div className="control-section">
                <div className="param-header">
                  <label className="section-label">Output Quality</label>
                  <span className="param-value">{params.prunaQuality ?? 80}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={params.prunaQuality ?? 80}
                  onChange={(e) => updateParam('prunaQuality', Number.parseInt(e.target.value))}
                  className="param-slider"
                />
                <span className="param-hint">JPEG quality (0-100), PNG ignores this</span>
              </div>
              
              {/* Enhance Details */}
              <div className="control-section">
                <div className="checkbox-row">
                  <input
                    type="checkbox"
                    id="enhance-details"
                    checked={params.prunaEnhanceDetails || false}
                    onChange={(e) => updateParam('prunaEnhanceDetails', e.target.checked)}
                  />
                  <label htmlFor="enhance-details" className="checkbox-label">
                    Enhance Details
                  </label>
                </div>
                <span className="param-hint">Enhance fine textures and small details</span>
              </div>
              
              {/* Enhance Realism */}
              <div className="control-section">
                <div className="checkbox-row">
                  <input
                    type="checkbox"
                    id="enhance-realism"
                    checked={params.prunaEnhanceRealism || false}
                    onChange={(e) => updateParam('prunaEnhanceRealism', e.target.checked)}
                  />
                  <label htmlFor="enhance-realism" className="checkbox-label">
                    Enhance Realism
                  </label>
                </div>
                <span className="param-hint">Improve realism (on by default, recommended for AI images)</span>
              </div>

              {/* Output Format */}
              <div className="control-section">
                <label className="section-label">Output Format</label>
                <div className="upscale-factor-row">
                  {(['png', 'jpg', 'webp'] as const).map(f => (
                    <button
                      key={f}
                      type="button"
                      className={`upscale-factor-btn ${(params.prunaOutputFormat ?? 'png') === f ? 'active' : ''}`}
                      onClick={() => updateParam('prunaOutputFormat', f)}
                    >
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
                <span className="param-hint">Quality slider applies to JPG/WebP only</span>
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <div className="control-row">
          {/* Resolution / Quality */}
          <div className="control-half" ref={resDropdownRef}>
            <label className="section-label">
              {selectedModel === 'openai/gpt-image-2' ? 'Quality' : 'Resolution'}
            </label>
            <div 
              className="dropdown-trigger"
              onClick={() => setShowResDropdown(!showResDropdown)}
            >
              <span>{params.resolution}</span>
              <ChevronDown size={16} />
            </div>
            {showResDropdown && (
              <div className="dropdown-menu small-menu">
                {availableResolutions.map(res => (
                  <div 
                    key={res}
                    className={`dropdown-item ${params.resolution === res ? 'active' : ''}`}
                    onClick={() => {
                      updateParam('resolution', res);
                      setShowResDropdown(false);
                    }}
                  >
                    {res}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Aspect Ratio */}
          <div className="control-half" ref={aspectDropdownRef}>
            <label className="section-label">Aspect ratio</label>
            <div 
              className="dropdown-trigger"
              onClick={() => setShowAspectDropdown(!showAspectDropdown)}
            >
              <span>{params.aspectRatio}</span>
              <ChevronDown size={16} />
            </div>
            {showAspectDropdown && (
              <div className="dropdown-menu small-menu">
                {availableAspectRatios.map(ratio => (
                  <div 
                    key={ratio}
                    className={`dropdown-item ${params.aspectRatio === ratio ? 'active' : ''}`}
                    onClick={() => {
                      updateParam('aspectRatio', ratio);
                      setShowAspectDropdown(false);
                    }}
                  >
                    {ratio}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      
        {/* Video Creator specific advanced controls */}
        {selectedTool === 'video-creator' && (
          <>
            {/* Duration Selector & input_reference Selector (for Sora) */}
            {selectedModel === 'openai/sora-2-pro' && (
              <>
                <div className="control-section" style={{ marginTop: '12px' }}>
                  <label className="section-label">Duration</label>
                  <div className="upscale-factor-row">
                    {['4s', '8s', '12s'].map(d => (
                      <button
                        key={d}
                        type="button"
                        className={`upscale-factor-btn ${(params.videoDuration ?? '4s') === d ? 'active' : ''}`}
                        onClick={() => updateParam('videoDuration', d)}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                {/* input_reference */}
                <PanelFileSelector
                  label="input_reference"
                  value={params.soraInputReference}
                  accept="image/*"
                  hint="Optional. An image to use as the first frame of the video. The image must be the same aspect ratio as the video."
                  onChange={(v) => updateParam('soraInputReference', v)}
                />
              </>
            )}

            {/* Kling Quality/Mode (for Kling v3) */}
            {selectedModel === 'kwaivgi/kling-v3-omni-video' && (
              <>
                {/* Duration Slider (3-15 seconds) */}
                <div className="control-section" style={{ marginTop: '12px' }}>
                  <div className="section-label-row">
                    <label className="section-label">duration</label>
                    <span className="param-value badge">{params.videoDuration ? parseInt(params.videoDuration.replace('s', ''), 10) : 5}</span>
                  </div>
                  <input
                    type="range"
                    min="3"
                    max="15"
                    step="1"
                    value={params.videoDuration ? parseInt(params.videoDuration.replace('s', ''), 10) : 5}
                    onChange={(e) => updateParam('videoDuration', `${e.target.value}s`)}
                    style={{ width: '100%', accentColor: '#e11d48', height: '6px', background: '#334155', borderRadius: '3px', cursor: 'pointer' }}
                  />
                  <span className="param-hint" style={{ display: 'block', marginTop: '4px', fontSize: '11px', color: '#64748b' }}>
                    Video duration in seconds (3-15). Ignored for video editing (base). Default: 5
                  </span>
                </div>

                {/* end_image */}
                <PanelFileSelector
                  label="end_image"
                  value={params.klingEndImage}
                  accept="image/*"
                  hint="Last frame image. Requires start_image. Supports .jpg/.jpeg/.png, max 10MB, min 300px."
                  onChange={(v) => updateParam('klingEndImage', v)}
                />



                {/* video_reference_type */}
                <div className="control-section" style={{ marginTop: '12px' }}>
                  <label className="section-label">video_reference_type</label>
                  <PanelSelect
                    value={params.klingVideoReferenceType ?? 'feature'}
                    options={[
                      { value: 'feature', label: 'feature' },
                      { value: 'base', label: 'base' }
                    ]}
                    onChange={(v) => updateParam('klingVideoReferenceType', v)}
                  />
                  <span className="param-hint" style={{ display: 'block', marginTop: '4px', fontSize: '11px', color: '#64748b' }}>
                    How to use reference video: 'feature' for style/camera reference, 'base' for video editing. Default: "feature"
                  </span>
                </div>

                {/* Checkboxes: keep_original_sound and generate_audio */}
                <div className="control-section" style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={params.klingKeepOriginalSound !== false}
                      onChange={(e) => updateParam('klingKeepOriginalSound', e.target.checked)}
                      style={{ accentColor: '#e11d48', cursor: 'pointer' }}
                    />
                    <span className="checkbox-label" style={{ marginLeft: '8px', fontSize: '13px', color: '#e2e8f0' }}>
                      keep_original_sound
                    </span>
                  </label>
                  <span className="param-hint" style={{ display: 'block', marginTop: '-4px', fontSize: '11px', color: '#64748b' }}>
                    Keep original sound from reference video. Default: true
                  </span>

                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', marginTop: '8px' }}>
                    <input
                      type="checkbox"
                      checked={params.klingGenerateAudio === true}
                      onChange={(e) => updateParam('klingGenerateAudio', e.target.checked)}
                      style={{ accentColor: '#e11d48', cursor: 'pointer' }}
                    />
                    <span className="checkbox-label" style={{ marginLeft: '8px', fontSize: '13px', color: '#e2e8f0' }}>
                      generate_audio
                    </span>
                  </label>
                  <span className="param-hint" style={{ display: 'block', marginTop: '-4px', fontSize: '11px', color: '#64748b' }}>
                    Generate native audio. Mutually exclusive with reference video. Default: false
                  </span>
                </div>
              </>
            )}

            {/* Grok Imagine Video settings */}
            {selectedModel === 'xai/grok-imagine-video-1.5' && (
              <>
                {/* Duration Slider (1-15 seconds) */}
                <div className="control-section" style={{ marginTop: '12px' }}>
                  <div className="section-label-row">
                    <label className="section-label">duration</label>
                    <span className="param-value badge">{params.videoDuration ? parseInt(params.videoDuration.replace('s', ''), 10) : 5}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="15"
                    step="1"
                    value={params.videoDuration ? parseInt(params.videoDuration.replace('s', ''), 10) : 5}
                    onChange={(e) => updateParam('videoDuration', `${e.target.value}s`)}
                    style={{ width: '100%', accentColor: '#e11d48', height: '6px', background: '#334155', borderRadius: '3px', cursor: 'pointer' }}
                  />
                  <span className="param-hint" style={{ display: 'block', marginTop: '4px', fontSize: '11px', color: '#64748b' }}>
                    Duration of the video in seconds. Default: 5
                  </span>
                </div>
              </>
            )}

            {/* Pruna AI Video settings */}
            {selectedModel === 'prunaai/p-video' && (
              <>
                {/* Duration Slider (1-20 seconds) */}
                <div className="control-section" style={{ marginTop: '12px' }}>
                  <div className="section-label-row">
                    <label className="section-label">duration</label>
                    <span className="param-value badge">{params.videoDuration ? parseInt(params.videoDuration.replace('s', ''), 10) : 5}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    step="1"
                    value={params.videoDuration ? parseInt(params.videoDuration.replace('s', ''), 10) : 5}
                    onChange={(e) => updateParam('videoDuration', `${e.target.value}s`)}
                    style={{ width: '100%', accentColor: '#e11d48', height: '6px', background: '#334155', borderRadius: '3px', cursor: 'pointer' }}
                  />
                  <span className="param-hint" style={{ display: 'block', marginTop: '4px', fontSize: '11px', color: '#64748b' }}>
                    Duration of the video in seconds (1-20). Ignored when audio is provided. Default: 5
                  </span>
                </div>

                {/* last_frame_image */}
                <PanelFileSelector
                  label="last_frame_image"
                  value={params.prunaLastFrameImage}
                  accept="image/*"
                  hint="Optional. Reference image for the last frame of the video. Supports jpg, jpeg, png, webp."
                  onChange={(v) => updateParam('prunaLastFrameImage', v)}
                />

                {/* audio */}
                <PanelFileSelector
                  label="audio"
                  value={params.prunaAudio}
                  accept="audio/*"
                  hint="Optional. Input audio to condition video generation. Supports flac, mp3, wav."
                  onChange={(v) => updateParam('prunaAudio', v)}
                />

                {/* fps Selector */}
                <div className="control-section" style={{ marginTop: '12px' }}>
                  <label className="section-label">fps</label>
                  <PanelSelect
                    value={params.prunaFps ?? 24}
                    options={[
                      { value: 24, label: '24' },
                      { value: 48, label: '48' }
                    ]}
                    onChange={(v) => updateParam('prunaFps', parseInt(v, 10))}
                  />
                </div>
              </>
            )}

            {/* Google Veo 3.1 Fast settings */}
            {selectedModel === 'google/veo-3.1-fast' && (
              <>
                {/* Duration Selector (4s, 6s, 8s) */}
                <div className="control-section" style={{ marginTop: '12px' }}>
                  <label className="section-label">Duration</label>
                  <div className="upscale-factor-row">
                    {['4s', '6s', '8s'].map(d => (
                      <button
                        key={d}
                        type="button"
                        className={`upscale-factor-btn ${(params.videoDuration ?? '8s') === d ? 'active' : ''}`}
                        onClick={() => updateParam('videoDuration', d)}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                {/* last_frame */}
                <PanelFileSelector
                  label="last_frame"
                  value={params.veoLastFrame}
                  accept="image/*"
                  hint="Optional. reference/preview of last frame."
                  onChange={(v) => updateParam('veoLastFrame', v)}
                />

                {/* generate_audio */}
                <div className="control-section" style={{ marginTop: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={params.veoGenerateAudio !== false}
                      onChange={(e) => updateParam('veoGenerateAudio', e.target.checked)}
                      style={{ accentColor: '#e11d48', cursor: 'pointer' }}
                    />
                    <span className="checkbox-label" style={{ marginLeft: '8px', fontSize: '13px', color: '#e2e8f0' }}>
                      generate_audio
                    </span>
                  </label>
                  <span className="param-hint" style={{ display: 'block', marginTop: '4px', fontSize: '11px', color: '#64748b' }}>
                    Generate audio with the video. Default: true
                  </span>
                </div>
              </>
            )}

            {/* PixVerse settings */}
            {selectedModel === 'pixverse/pixverse-v6' && (
              <>
                {/* Duration Selector (5s, 8s, 10s, 15s) */}
                <div className="control-section" style={{ marginTop: '12px' }}>
                  <label className="section-label">Duration</label>
                  <div className="upscale-factor-row">
                    {['5s', '8s', '10s', '15s'].map(d => (
                      <button
                        key={d}
                        type="button"
                        className={`upscale-factor-btn ${(params.videoDuration ?? '15s') === d ? 'active' : ''}`}
                        onClick={() => updateParam('videoDuration', d)}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                {/* last_frame_image */}
                <PanelFileSelector
                  label="last_frame_image"
                  value={params.pixverseLastFrameImage}
                  accept="image/*"
                  hint="Optional. Use to generate a video that transitions from the first image to the last image. Must be used with image."
                  onChange={(v) => updateParam('pixverseLastFrameImage', v)}
                />

                {/* Checkboxes: generate_audio_switch and generate_multi_clip_switch */}
                <div className="control-section" style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={params.pixverseGenerateAudioSwitch === true}
                      onChange={(e) => updateParam('pixverseGenerateAudioSwitch', e.target.checked)}
                      style={{ accentColor: '#e11d48', cursor: 'pointer' }}
                    />
                    <span className="checkbox-label" style={{ marginLeft: '8px', fontSize: '13px', color: '#e2e8f0' }}>
                      generate_audio_switch
                    </span>
                  </label>
                  <span className="param-hint" style={{ display: 'block', marginTop: '-4px', fontSize: '11px', color: '#64748b' }}>
                    Enable AI-generated audio including BGM, SFX, and character dialogues. Default: false
                  </span>

                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', marginTop: '8px' }}>
                    <input
                      type="checkbox"
                      checked={params.pixverseGenerateMultiClipSwitch === true}
                      onChange={(e) => updateParam('pixverseGenerateMultiClipSwitch', e.target.checked)}
                      style={{ accentColor: '#e11d48', cursor: 'pointer' }}
                    />
                    <span className="checkbox-label" style={{ marginLeft: '8px', fontSize: '13px', color: '#e2e8f0' }}>
                      generate_multi_clip_switch
                    </span>
                  </label>
                  <span className="param-hint" style={{ display: 'block', marginTop: '-4px', fontSize: '11px', color: '#64748b' }}>
                    Enable multi-shot generation for cinematic sequences with scene transitions. Default: false
                  </span>
                </div>
              </>
            )}

            {/* Pruna Video Quality Slider */}
            {selectedModel === 'prunaai/p-video' && (
              <div className="control-section" style={{ marginTop: '12px' }}>
                <div className="section-label-row">
                  <label className="section-label">Output Quality</label>
                  <span className="param-value badge">{params.prunaQuality ?? 80}</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={params.prunaQuality ?? 80}
                  onChange={(e) => updateParam('prunaQuality', Number.parseInt(e.target.value))}
                  className="param-slider"
                />
                <div className="slider-hints">
                  <span>10</span>
                  <span>100</span>
                </div>
              </div>
            )}
            {/* Seedance 2.0 specific settings */}
            {selectedModel === 'bytedance/seedance-2.0' && (
              <>
                {/* Duration Slider (-1 to 15) */}
                <div className="control-section" style={{ marginTop: '12px' }}>
                  <div className="section-label-row">
                    <label className="section-label">Duration</label>
                    <span className="param-value badge">
                      {params.videoDuration === '-1' || (params.videoDuration as any) === -1
                        ? 'Intelligent (-1)'
                        : `${params.videoDuration ?? 5}s`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="12"
                    step="1"
                    value={(() => {
                      const allowed = [-1, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
                      const currentVal = params.videoDuration != null ? Number(params.videoDuration) : 5;
                      const idx = allowed.indexOf(currentVal);
                      return idx === -1 ? 2 : idx; // default to 5s (index 2)
                    })()}
                    onChange={(e) => {
                      const allowed = [-1, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
                      const idx = Number(e.target.value);
                      const resolvedVal = allowed[idx] ?? 5;
                      updateParam('videoDuration', String(resolvedVal));
                    }}
                    className="param-slider"
                  />
                  <div className="slider-hints">
                    <span>Intelligent (-1)</span>
                    <span>15s</span>
                  </div>
                </div>

                {/* Generate Audio Toggle */}
                <div className="control-section" style={{ marginTop: '12px' }}>
                  <label className="checkbox-container" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={params.seedanceGenerateAudio !== false}
                      onChange={(e) => updateParam('seedanceGenerateAudio', e.target.checked)}
                      style={{ accentColor: '#e11d48', cursor: 'pointer' }}
                    />
                    <span className="checkbox-label" style={{ marginLeft: '8px', fontSize: '13px', color: '#e2e8f0' }}>
                      Generate Audio
                    </span>
                  </label>
                  <span className="param-hint" style={{ display: 'block', marginTop: '4px', fontSize: '11px', color: '#64748b' }}>
                    Generate synchronized audio including background music and dialogue.
                  </span>
                </div>

                {/* Last Frame Image File Input */}
                <div className="control-section" style={{ marginTop: '12px' }}>
                  <label className="section-label">Last Frame Image</label>
                  {params.seedanceLastFrameImage ? (
                    <div style={{ position: 'relative', marginTop: '6px', borderRadius: '6px', overflow: 'hidden', border: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', padding: '4px' }}>
                      <img
                        src={params.seedanceLastFrameImage}
                        alt="Last Frame"
                        style={{ maxHeight: '100px', objectFit: 'contain', borderRadius: '4px' }}
                      />
                      <button
                        type="button"
                        onClick={() => updateParam('seedanceLastFrameImage', null)}
                        style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(244,63,94,0.85)', color: '#fff', border: 'none', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                        title="Remove image"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div 
                      onClick={() => {
                        const fileInput = document.createElement('input');
                        fileInput.type = 'file';
                        fileInput.accept = 'image/*';
                        fileInput.onchange = (e: any) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              updateParam('seedanceLastFrameImage', ev.target?.result as string);
                            };
                            reader.readAsDataURL(file);
                          }
                        };
                        fileInput.click();
                      }}
                      style={{ marginTop: '6px', cursor: 'pointer', border: '1px dashed #475569', borderRadius: '6px', padding: '12px', textAlign: 'center', backgroundColor: 'rgba(30,41,59,0.5)', color: '#94a3b8', fontSize: '12px', transition: 'border-color 0.2s' }}
                      onMouseOver={(e) => e.currentTarget.style.borderColor = '#e11d48'}
                      onMouseOut={(e) => e.currentTarget.style.borderColor = '#475569'}
                    >
                      Click to upload last frame image
                    </div>
                  )}
                  <span className="param-hint" style={{ display: 'block', marginTop: '4px', fontSize: '11px', color: '#64748b' }}>
                    Only works if a first frame image is also provided via connected nodes.
                  </span>
                </div>
              </>
            )}
          </>
        )}
        </>
      )}

      {/* ── Anarchy Creator (Reve AI) Advanced Controls ── */}
      {selectedTool === 'anarchy-creator' && (
        <div className="anarchy-generation-container" style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '8px' }}>
          
          {/* Postprocessing & Effects Suite */}
          <div className="anarchy-section-card" style={{
            background: 'rgba(255, 255, 255, 0.025)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.5)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={12} style={{ color: '#e11d48' }} /> Postprocessing & Effects
            </div>

            {/* Remove Background */}
            <div className="control-section">
              <label className="checkbox-container" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={params.anarchyRemoveBackground === true}
                  onChange={(e) => updateParam('anarchyRemoveBackground', e.target.checked)}
                  style={{ accentColor: '#e11d48', cursor: 'pointer', width: '16px', height: '16px' }}
                />
                <span className="checkbox-label" style={{ marginLeft: '8px', fontSize: '12px', fontWeight: 500, color: '#f1f5f9' }}>
                  Remove Background
                </span>
              </label>
              <span className="param-hint" style={{ display: 'block', marginTop: '3px', fontSize: '11px', color: '#64748b' }}>
                Automatically isolate main subject and output transparent PNG.
              </span>
            </div>

            {/* Upscale Modifier */}
            <div className="control-section">
              <label className="section-label" style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '6px', display: 'block' }}>
                Postprocessing Upscale
              </label>
              <div className="upscale-factor-row" style={{ display: 'flex', gap: '6px' }}>
                {['Off', '2x', '3x', '4x'].map(factor => (
                  <button
                    key={factor}
                    type="button"
                    className={`upscale-factor-btn ${(params.anarchyUpscaleFactor ?? 'Off') === factor ? 'active' : ''}`}
                    onClick={() => updateParam('anarchyUpscaleFactor', factor as any)}
                    style={{
                      flex: 1,
                      padding: '6px 0',
                      fontSize: '11px',
                      fontWeight: 600,
                      borderRadius: '6px',
                      border: (params.anarchyUpscaleFactor ?? 'Off') === factor ? '1px solid #e11d48' : '1px solid rgba(255, 255, 255, 0.1)',
                      background: (params.anarchyUpscaleFactor ?? 'Off') === factor ? 'rgba(225, 29, 72, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                      color: (params.anarchyUpscaleFactor ?? 'Off') === factor ? '#ffffff' : '#94a3b8',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {factor}
                  </button>
                ))}
              </div>
              <span className="param-hint" style={{ display: 'block', marginTop: '4px', fontSize: '11px', color: '#64748b' }}>
                Upscale final image resolution by 2x, 3x, or 4x factor.
              </span>
            </div>

            {/* Preset Effects */}
            <div className="control-section">
              <label className="section-label" style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '6px', display: 'block' }}>
                Preset Effect Filter
              </label>
              <PanelSelect
                value={params.anarchyEffect ?? 'None'}
                options={[
                  { value: 'None', label: 'None (No effect)' },
                  { value: 'sketch', label: 'Sketch Filter' },
                  { value: 'oil_painting', label: 'Oil Painting' },
                  { value: 'cartoon', label: 'Cartoon Style' },
                  { value: 'cyberpunk', label: 'Cyberpunk Glow' },
                  { value: 'pencil_drawing', label: 'Pencil Sketch' },
                  { value: 'watercolor', label: 'Watercolor Wash' }
                ]}
                onChange={(v) => updateParam('anarchyEffect', v)}
              />
              <span className="param-hint" style={{ display: 'block', marginTop: '4px', fontSize: '11px', color: '#64748b' }}>
                Apply a preset artistic effect filter to generated image.
              </span>
            </div>
          </div>

          {/* Reve Interactive Helpers & Guide */}
          {(selectedModel === 'reve/edit-fast' || selectedModel === 'reve/create') && (
            <div className="control-section" style={{
              background: 'rgba(139, 92, 246, 0.06)',
              border: '1px solid rgba(139, 92, 246, 0.25)',
              borderRadius: '12px',
              padding: '12px'
            }}>
              <label className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#c4b5fd', fontWeight: 600, fontSize: '12px', marginBottom: '8px' }}>
                <span>🖌️</span> Edit Inside the Image
              </label>
              <div style={{ fontSize: '11.5px', color: '#a78bfa', lineHeight: '1.5' }}>
                Reference connected images inside your prompt using frame tags:
              </div>
              
              <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                {['<frame>0</frame>', '<frame>1</frame>', '<frame>2</frame>'].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      try {
                        navigator.clipboard.writeText(tag);
                      } catch {}
                    }}
                    title="انقر لنسخ الوسم | Click to copy frame reference"
                    style={{
                      background: 'rgba(139, 92, 246, 0.15)',
                      border: '1px solid rgba(139, 92, 246, 0.4)',
                      borderRadius: '6px',
                      color: '#ddd6fe',
                      fontSize: '11px',
                      padding: '3px 8px',
                      fontFamily: 'monospace',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    + {tag}
                  </button>
                ))}
              </div>

              <div style={{ marginTop: '10px', fontSize: '11px', color: '#94a3b8', lineHeight: '1.6' }}>
                <div style={{ color: '#c4b5fd', fontWeight: 600, marginBottom: '2px' }}>Examples:</div>
                <div>• <span style={{ color: '#e2e8f0' }}>Remove:</span> "Remove people from &lt;frame&gt;0&lt;/frame&gt;"</div>
                <div>• <span style={{ color: '#e2e8f0' }}>Change:</span> "Make sky sunset in &lt;frame&gt;0&lt;/frame&gt;"</div>
                <div>• <span style={{ color: '#e2e8f0' }}>Mix:</span> "Apply style of &lt;frame&gt;0&lt;/frame&gt; to &lt;frame&gt;1&lt;/frame&gt;"</div>
              </div>
            </div>
          )}

          {/* Extract Layout Mode */}
          {selectedModel === 'reve/extract-layout' && (
            <div className="control-section" style={{
              background: 'rgba(139, 92, 246, 0.06)',
              border: '1px solid rgba(139, 92, 246, 0.25)',
              borderRadius: '12px',
              padding: '12px'
            }}>
              <label className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#c4b5fd', fontWeight: 600, fontSize: '12px', marginBottom: '6px' }}>
                <span>🗺️</span> Extract Layout Mode
              </label>
              <div style={{ fontSize: '11.5px', color: '#a78bfa', lineHeight: '1.5' }}>
                Analyzes connected images to extract bounding boxes, region labels (`sky`, `wall`, `pool`), and color palettes onto interactive layout canvas.
              </div>
            </div>
          )}

          {/* Create Layout Mode */}
          {selectedModel === 'reve/create-layout' && (
            <div className="control-section" style={{
              background: 'rgba(139, 92, 246, 0.06)',
              border: '1px solid rgba(139, 92, 246, 0.25)',
              borderRadius: '12px',
              padding: '12px'
            }}>
              <label className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#c4b5fd', fontWeight: 600, fontSize: '12px', marginBottom: '6px' }}>
                <span>📐</span> Create Layout Mode
              </label>
              <div style={{ fontSize: '11.5px', color: '#a78bfa', lineHeight: '1.5' }}>
                Generates interactive layout map with bounding boxes directly from prompt commands (`add`, `shift`, `remove`, `change`, `keep`).
              </div>
            </div>
          )}

          {/* Render Layout Mode */}
          {selectedModel === 'reve/render-layout' && (
            <div className="control-section" style={{
              background: 'rgba(139, 92, 246, 0.06)',
              border: '1px solid rgba(139, 92, 246, 0.25)',
              borderRadius: '12px',
              padding: '12px'
            }}>
              <label className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#c4b5fd', fontWeight: 600, fontSize: '12px', marginBottom: '6px' }}>
                <span>🎨</span> Render Layout Mode
              </label>
              <div style={{ fontSize: '11.5px', color: '#a78bfa', lineHeight: '1.5' }}>
                Renders high-fidelity image output from JSON layout structure using connected node images as pixel context references.
              </div>
            </div>
          )}

          {/* Reconcile Layouts Mode */}
          {selectedModel === 'reve/reconcile-layouts' && (
            <div className="control-section" style={{
              background: 'rgba(139, 92, 246, 0.06)',
              border: '1px solid rgba(139, 92, 246, 0.25)',
              borderRadius: '12px',
              padding: '12px'
            }}>
              <label className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#c4b5fd', fontWeight: 600, fontSize: '12px', marginBottom: '6px' }}>
                <span>🔄</span> Reconcile Layouts Mode
              </label>
              <div style={{ fontSize: '11.5px', color: '#a78bfa', lineHeight: '1.5' }}>
                Seamlessly reconciles manual user layout edits with original layout structure to preserve scene lighting and perspective.
              </div>
            </div>
          )}

        </div>
      )}

      {/* Custom Width and Height sliders (only shown when resolution is custom) */}
      {params.resolution === 'custom' && (
        <div className="control-section" style={{ marginTop: '8px' }}>
          <div className="control-row">
            <div className="control-half" style={{ width: '100%' }}>
              <div className="section-label-row">
                <label className="section-label">Custom Width</label>
                <span className="param-value badge">{params.width ?? 2048}px</span>
              </div>
              <input
                type="range"
                min="1024"
                max="4096"
                step="64"
                value={params.width ?? 2048}
                onChange={(e) => updateParam('width', Number.parseInt(e.target.value))}
                className="param-slider"
              />
              <div className="slider-hints">
                <span>1024</span>
                <span>4096</span>
              </div>
            </div>
          </div>
          <div className="control-row" style={{ marginTop: '12px' }}>
            <div className="control-half" style={{ width: '100%' }}>
              <div className="section-label-row">
                <label className="section-label">Custom Height</label>
                <span className="param-value badge">{params.height ?? 2048}px</span>
              </div>
              <input
                type="range"
                min="1024"
                max="4096"
                step="64"
                value={params.height ?? 2048}
                onChange={(e) => updateParam('height', Number.parseInt(e.target.value))}
                className="param-slider"
              />
              <div className="slider-hints">
                <span>1024</span>
                <span>4096</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Seedream Sequential Generation settings ── */}
      {(selectedEngine.id as string) === 'bytedance/seedream-4.5' && (
        <div className="control-section" ref={seqDropdownRef}>
          <div className="control-row">
            <div className="control-half" style={{ width: '100%' }}>
              <label className="section-label">Sequential Image Generation</label>
              <div 
                className="dropdown-trigger"
                onClick={() => setShowSeqDropdown(!showSeqDropdown)}
              >
                <span>{params.sequentialImageGeneration || 'disabled'}</span>
                <ChevronDown size={16} />
              </div>
              {showSeqDropdown && (
                <div className="dropdown-menu">
                  {['disabled', 'auto'].map(val => (
                    <div 
                      key={val}
                      className={`dropdown-item ${params.sequentialImageGeneration === val ? 'active' : ''}`}
                      onClick={() => {
                        updateParam('sequentialImageGeneration', val);
                        setShowSeqDropdown(false);
                      }}
                    >
                      {val}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {(params.sequentialImageGeneration === 'auto') && (
            <div className="control-section" style={{ marginTop: '16px', padding: 0 }}>
              <div className="section-label-row">
                <label className="section-label">Max Images</label>
                <span className="param-value badge">{params.maxImages ?? 1}</span>
              </div>
              <input
                type="range"
                min="1"
                max="15"
                step="1"
                value={params.maxImages ?? 1}
                onChange={(e) => updateParam('maxImages', Number.parseInt(e.target.value))}
                className="param-slider"
              />
              <div className="slider-hints">
                <span>1</span>
                <span>15</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Krea 2 Large Creativity Setting ── */}
      {(selectedEngine.id as string) === 'krea/krea-2-large' && (
        <div className="control-section">
          <label className="section-label">Creativity</label>
          <div className="upscale-factor-row">
            {(['raw', 'low', 'medium', 'high'] as const).map(level => (
              <button
                key={level}
                type="button"
                className={`upscale-factor-btn ${(params.kreaCreativity ?? 'medium') === level ? 'active' : ''}`}
                onClick={() => updateParam('kreaCreativity', level)}
                style={{ textTransform: 'capitalize' }}
              >
                {level}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Steps ── */}
      {!isUpscalingTool && modelSettings.supportsSteps && (
        <div className="control-section">
          <div className="section-label-row">
            <label className="section-label">Steps</label>
            <span className="param-value badge">{params.steps ?? modelSettings.defaultSteps}</span>
          </div>
          <input
            type="range"
            min={modelSettings.stepsRange[0]}
            max={modelSettings.stepsRange[1]}
            step="1"
            value={params.steps ?? modelSettings.defaultSteps}
            onChange={(e) => updateParam('steps', Number.parseInt(e.target.value))}
            className="param-slider"
          />
          <div className="slider-hints">
            <span>{modelSettings.stepsRange[0]}</span>
            <span>{modelSettings.stepsRange[1]}</span>
          </div>
        </div>
      )}

      {/* ── Seed ── */}
      {!isUpscalingTool && modelSettings.supportsSeed && (
        <div className="control-section">
          <div className="section-label-row">
            <label className="section-label">Seed</label>
            <span className="param-hint">for consistency</span>
          </div>
          <div className="seed-row">
          <input
            type="number"
            className="param-input"
            placeholder="Random"
            value={params.seed ?? ''}
            onChange={(e) => updateParam('seed', e.target.value ? Number.parseInt(e.target.value) : null)}
          />
          <button
            className="seed-random-btn"
            title="Random seed"
            onClick={() => updateParam('seed', Math.floor(Math.random() * 2147483647))}
          >🎲</button>
          <button
            className="seed-clear-btn"
            title="Clear seed"
            onClick={() => updateParam('seed', null)}
          >✕</button>
          </div>
        </div>
      )}

      {/* ── Reference Strength ── */}
      {!isUpscalingTool && replicateService.getModelCapabilities(selectedModel).supportsReferenceStrength && (
        <div className="control-section">
          <div className="section-label-row">
            <label className="section-label">Reference Strength</label>
            <span className="param-value badge">{(params.referenceStrength ?? 0.85).toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={params.referenceStrength ?? 0.85}
            onChange={(e) => updateParam('referenceStrength', Number.parseFloat(e.target.value))}
            className="param-slider"
          />
          <div className="slider-hints"><span>Low influence</span><span>High influence</span></div>
        </div>
      )}

      {/* ── Negative Prompt ── */}
      {!isUpscalingTool && modelSettings.supportsNegativePrompt && (
        <div className="control-section">
          <label className="section-label">Negative Prompt</label>
          <textarea
            className="param-textarea"
            placeholder="blur, low quality, distorted, ugly, deformed, watermark, signature, text, bad anatomy..."
            rows={2}
            value={params.negativePrompt ?? ''}
            onChange={(e) => updateParam('negativePrompt', e.target.value)}
          />
          <span className="param-hint">Specify what to avoid in the generated image</span>
        </div>
      )}

      {/* ── Style Type ── */}
      {!isUpscalingTool && modelSettings.supportsStyleType && (
        <div className="control-section" ref={styleTypeDropdownRef}>
          <label className="section-label">Style Type</label>
          <div 
            className="dropdown-trigger"
            onClick={() => setShowStyleTypeDropdown(!showStyleTypeDropdown)}
          >
            <span>{params.styleType || 'None'}</span>
            <ChevronDown size={16} />
          </div>
          {showStyleTypeDropdown && (
            <div className="dropdown-menu small-menu">
              {['None', ...(modelSettings.styleTypes || [])].map(type => (
                <div 
                  key={type}
                  className={`dropdown-item ${params.styleType === type ? 'active' : ''}`}
                  onClick={() => {
                    updateParam('styleType', type === 'None' ? 'None' : type);
                    setShowStyleTypeDropdown(false);
                  }}
                >
                  {type}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Style Preset ── */}
      {!isUpscalingTool && modelSettings.supportsStylePreset && (
        <div className="control-section" ref={stylePresetDropdownRef}>
          <label className="section-label">Style Preset</label>
          <div 
            className="dropdown-trigger"
            onClick={() => setShowStylePresetDropdown(!showStylePresetDropdown)}
          >
            <span>{params.stylePreset || 'None'}</span>
            <ChevronDown size={16} />
          </div>
          {showStylePresetDropdown && (
            <div className="dropdown-menu small-menu" style={{ maxHeight: '300px', overflow: 'auto' }}>
              {['None', ...(modelSettings.stylePresets || [])].map(preset => (
                <div 
                  key={preset}
                  className={`dropdown-item ${params.stylePreset === preset ? 'active' : ''}`}
                  onClick={() => {
                    updateParam('stylePreset', preset === 'None' ? 'None' : preset);
                    setShowStylePresetDropdown(false);
                  }}
                >
                  {preset}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default AIControlPanel;
