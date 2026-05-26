/**
 * AI Control Panel - Clean Professional Design
 * Tool → Engine → Resolution → Aspect Ratio flow
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  ChevronDown, Check, Wand2, ImagePlus, Maximize2, 
  Film, Zap, Sparkles,
  Banana,
  Flame, Crown, Star,
  Image as ImageIcon
} from 'lucide-react';
import { replicateService, type ReplicateImageModel, type ReplicateUpscaleModel } from '../../services/replicate';
import { useAIConfigStore } from '../../stores/aiConfigStore';
import type { WatermarkPosition } from '../../stores/aiConfigStore';
import './AIControlPanel.css';

interface AIControlPanelProps {
  selectedModel: ReplicateImageModel | ReplicateUpscaleModel;
  onModelChange: (model: ReplicateImageModel | ReplicateUpscaleModel) => void;
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
    // Style settings
    styleType?: string;
    stylePreset?: string;
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

// Tool types matching the reference design
type ToolType = 'image-editor' | 'image-creator' | 'image-upscaler' | 'video-creator' | '3d-creator';

const TOOLS: { id: ToolType; name: string; icon: React.ReactNode; disabled?: boolean }[] = [
  { id: 'image-editor',   name: 'Image Editing',     icon: <Wand2 size={16} /> },
  { id: 'image-upscaler', name: 'Image Upscaling',   icon: <Maximize2 size={16} /> },
  { id: 'image-creator',  name: 'Image Generation',  icon: <ImagePlus size={16} />, disabled: true },
  { id: 'video-creator',  name: 'Video Generation',  icon: <Film size={16} />,      disabled: true },
];

// Engine/Models definition - supports all model types (image, upscale, video, 3D, chat)
interface Engine {
  id: ReplicateImageModel | ReplicateUpscaleModel;
  name: string;
  provider: 'Google' | 'BlackForest' | 'Recraft' | 'Together' | 'ByteDance' | 'OpenAI' | 'Replicate';
  color: string;
  icon: React.ReactNode;
  tool: ToolType;
  badge?: string;
}


const ENGINES: Engine[] = [
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
    id: 'bytedance/seedream-4.5',
    name: 'Seedream 4.5',
    provider: 'ByteDance',
    color: '#e11d48',
    icon: <Zap size={18} />,
    tool: 'image-editor'
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
    id: 'black-forest-labs/flux-kontext-pro',
    name: 'FLUX Kontext Pro',
    provider: 'BlackForest',
    color: '#e11d48',
    icon: <Star size={18} />,
    tool: 'image-editor',
    badge: 'Pro'
  },
  {
    id: 'xai/grok-imagine-image',
    name: 'Grok Imagine',
    provider: 'Replicate',
    color: '#e11d48',
    icon: <Zap size={18} />,
    tool: 'image-editor',
  },
  {
    id: 'stability-ai/stable-diffusion-3.5',
    name: 'Stable Diffusion 3.5',
    provider: 'Replicate',
    color: '#8b5cf6',
    icon: <ImageIcon size={18} />,
    tool: 'image-editor',
    badge: 'SD 3.5'
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
    id: 'nightmareai/real-esrgan' as ReplicateImageModel,
    name: 'Real-ESRGAN',
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

  // Ref to track previous tool value
  const prevSelectedToolRef = useRef<ToolType>(selectedTool);
  
  // Sync external config changes to local state (when config changes from outside)
  useEffect(() => {
    if (config.selectedTool !== selectedTool) {
      setSelectedTool(config.selectedTool);
      prevSelectedToolRef.current = config.selectedTool;
    }
  }, [config.selectedTool]);
  
  // Sync selectedTool to AIConfigContext - only when local tool changes
  useEffect(() => {
    if (prevSelectedToolRef.current !== selectedTool) {
      prevSelectedToolRef.current = selectedTool;
      setConfig(prev => ({ ...prev, selectedTool }));
    }
  }, [selectedTool, setConfig]);

  // Refs for dropdown containers
  const toolDropdownRef = useRef<HTMLDivElement>(null);
  const engineDropdownRef = useRef<HTMLDivElement>(null);
  const resDropdownRef = useRef<HTMLDivElement>(null);
  const aspectDropdownRef = useRef<HTMLDivElement>(null);
  const styleTypeDropdownRef = useRef<HTMLDivElement>(null);
  const stylePresetDropdownRef = useRef<HTMLDivElement>(null);

  const availableEngines = useMemo(
    () => ENGINES.filter(engine => engine.tool === selectedTool),
    [selectedTool]
  );

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
    
    // Apply updates if needed
    if (Object.keys(updates).length > 0) {
      onParamsChange({ ...params, ...updates });
    }
  }, [selectedModel, availableResolutions, availableAspectRatios, modelSettings, onParamsChange]);

  // Only auto-switch model when tool changes, not on every render
  const prevToolRef = useRef<ToolType>(selectedTool);
  const selectedModelRef = useRef(selectedModel);
  selectedModelRef.current = selectedModel;
  
  useEffect(() => {
    const toolChanged = prevToolRef.current !== selectedTool;
    prevToolRef.current = selectedTool;
    
    // Only change model if tool changed AND current model is not available in new tool
    if (toolChanged && availableEngines.length > 0 && !availableEngines.some(engine => engine.id === selectedModelRef.current)) {
      onModelChange(availableEngines[0].id as ReplicateImageModel | ReplicateUpscaleModel);
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
    };

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const insideAny = (
        (toolDropdownRef.current?.contains(target)) ||
        (engineDropdownRef.current?.contains(target)) ||
        (resDropdownRef.current?.contains(target)) ||
        (aspectDropdownRef.current?.contains(target)) ||
        (styleTypeDropdownRef.current?.contains(target)) ||
        (stylePresetDropdownRef.current?.contains(target))
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
  const supportsUpscaleFactor = (selectedModel as string) === 'nightmareai/real-esrgan' ||   // 1x-10x
                                 (selectedModel as string) === 'prunaai/p-image-upscale';     // 1x, 2x, 4x, 8x, 16x

  return (
    <div className="ai-control-v2">
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
                  setShowEngineDropdown(false);
                  setShowToolDropdown(false);
                }}
              >
                {tool.icon}
                <span className="tool-name">{tool.name}</span>
                {tool.disabled 
                  ? <span className="coming-soon">Coming soon</span>
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
                  onModelChange(engine.id as ReplicateImageModel | ReplicateUpscaleModel);
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
                  {UPSCALE_FACTORS.filter(factor => {
                    if ((selectedModel as string) === 'nightmareai/real-esrgan') {
                      return factor >= 1 && factor <= 10;
                    }
                    return true;
                  }).map(factor => {
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
                  onChange={(e) => updateParam('clarityResemblance', parseFloat(e.target.value))}
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
