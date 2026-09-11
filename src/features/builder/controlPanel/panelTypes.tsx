/**
 * AI Control Panel - Clean Professional Design
 * Tool → Engine → Resolution → Aspect Ratio flow
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  ChevronDown, Check, Wand2, ImagePlus, Maximize2, 
  Film, Zap, Sparkles,
  Banana,
  Flame, Crown, Star, Sun,
  Sprout, Clapperboard, Brain, Layers, Rocket, Globe,
  X, FolderOpen, Volume2
} from 'lucide-react';
import { replicateService, type ReplicateImageModel, type ReplicateUpscaleModel, type ReplicateVideoModel } from '../../../services/replicate';
import { useAIConfigStore, type WatermarkPosition } from '../../../stores/aiConfigStore';
import { getModelCost, costTopazUpscale, costClarityUpscale, costPrunaUpscale, costAnarchyUpscale } from '../../../services/credit/creditService';
import '../AIControlPanel.css';

export interface AIControlPanelProps {
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
    qualityVariant?: string;
    gptQuality?: string;
    gptVariant?: string;
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
    // Anarchy Upscale (Clarity Pro) settings
    anarchyUpscaleScale?: number;
    anarchyUpscaleCreativity?: number;
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

export const UPSCALE_FACTORS = [1, 2, 4, 8, 16] as const;

// ── Custom Select Dropdown (replaces native <select>) ────────────────────────
export interface PanelSelectOption { value: string | number; label: string; }
export interface PanelSelectProps {
  value: string | number;
  options: PanelSelectOption[];
  onChange: (v: string) => void;
  className?: string;
}
export const PanelSelect: React.FC<PanelSelectProps> = ({ value, options, onChange, className }) => {
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

export interface PanelFileSelectorProps {
  label: string;
  value: string | null | undefined;
  accept: string;
  hint?: string;
  placeholder?: string;
  onChange: (url: string | null) => void;
}
export const PanelFileSelector: React.FC<PanelFileSelectorProps> = ({
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
export type ToolType = 'image-editor' | 'image-creator' | 'image-upscaler' | 'video-creator' | '3d-creator' | 'anarchy-creator';

export const TOOLS: { id: ToolType; name: string; icon: React.ReactNode; disabled?: boolean }[] = [
  { id: 'image-editor',   name: 'Image Studio',      icon: <Wand2 size={16} /> },
  { id: 'image-upscaler', name: 'Image Upscaling',   icon: <Maximize2 size={16} /> },
  { id: 'video-creator',  name: 'Video Studio',      icon: <Film size={16} /> },
  { id: 'anarchy-creator', name: 'Anarchy Generation', icon: <Sparkles size={16} />, disabled: true },
];

// Engine/Models definition - supports all model types (image, upscale, video, 3D, chat)
export interface Engine {
  id: ReplicateImageModel | ReplicateUpscaleModel | ReplicateVideoModel;
  name: string;
  provider: 'Google' | 'BlackForest' | 'Recraft' | 'Together' | 'ByteDance' | 'OpenAI' | 'Replicate' | 'Anarchy AI';
  color: string;
  icon: React.ReactNode;
  tool: ToolType;
  badge?: string;
  /** If true, only shown when studioMode === 'generate' inside image-editor */
  generateOnly?: boolean;
}


export const ENGINES: Engine[] = [
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
    id: 'openai/gpt-image-2.5-flare',
    name: 'GPT Image 2.5',
    provider: 'OpenAI',
    color: '#10a37f',
    icon: <Sparkles size={18} />,
    tool: 'image-editor',
    badge: '2.5'
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
    id: 'philz1337x/clarity-pro-upscaler' as ReplicateImageModel,
    name: 'Anarchy Upscale',
    provider: 'Replicate',
    color: '#e11d48',
    icon: <Sparkles size={18} />,
    tool: 'image-upscaler',
    badge: 'Pro'
  },
  {
    id: 'prunaai/p-image-upscale' as ReplicateImageModel,
    name: 'Pruna AI Upscale',
    provider: 'Replicate',
    color: '#e11d48',
    icon: <Maximize2 size={18} />,
    tool: 'image-upscaler'
  },
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
];
