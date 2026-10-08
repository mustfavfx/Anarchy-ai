/**
 * AI Control Panel - Clean Professional Modular Architecture
 * Tool → Engine → Resolution → Aspect Ratio flow
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  ChevronDown, Check, Wand2, Sparkles, Flame, Sun, Zap, Clock
} from 'lucide-react';
import { 
  replicateService, 
  type ReplicateImageModel, 
  type ReplicateUpscaleModel, 
  type ReplicateVideoModel 
} from '../../services/replicate';
import { useAIConfigStore } from '../../stores/aiConfigStore';
import { 
  getModelCost, 
  costTopazUpscale, 
  costPrunaUpscale, 
  costAnarchyUpscale 
} from '../../services/credit/creditService';
import { 
  type AIControlPanelProps, 
  type ToolType, 
  type Engine,
  TOOLS, 
  ENGINES, 
  UPSCALE_FACTORS,
  PanelSelect,
  PanelFileSelector
} from './controlPanel/panelTypes';
import { UpscalerSettingsSection } from './controlPanel/UpscalerSettingsSection';
import { VideoSettingsSection } from './controlPanel/VideoSettingsSection';
import { AnarchyCreatorSection } from './controlPanel/AnarchyCreatorSection';
import { GeneralParamsSection } from './controlPanel/GeneralParamsSection';
import { AspectRatioIcon, getAspectRatioHint } from '../../shared/components/AspectRatioIcon';
import './AIControlPanel.css';

export type { AIControlPanelProps, ToolType, Engine };
export { TOOLS, ENGINES, UPSCALE_FACTORS, PanelSelect, PanelFileSelector };

export const AIControlPanel: React.FC<AIControlPanelProps> = ({
  selectedModel,
  onModelChange,
  params,
  onParamsChange
}) => {
  const config = useAIConfigStore((state) => state.config);
  const setConfig = useAIConfigStore((state) => state.setConfig);
  const selectedTool: ToolType = config.selectedTool || 'image-editor';
  
  const [showToolDropdown, setShowToolDropdown] = useState(false);
  const [showEngineDropdown, setShowEngineDropdown] = useState(false);
  const [showResDropdown, setShowResDropdown] = useState(false);
  const [showAspectDropdown, setShowAspectDropdown] = useState(false);

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
  const selectedNode = useAIConfigStore((state) => state.selectedNode);
  const topazFactorStr = params.topazUpscaleFactor ?? '4x';
  const topazFactor = useMemo(() => {
    if (topazFactorStr === 'None' || topazFactorStr === '1x') return 1;
    if (topazFactorStr === '2x') return 2;
    if (topazFactorStr === '4x') return 4;
    if (topazFactorStr === '6x') return 6;
    return 4;
  }, [topazFactorStr]);

  const topazDims = useMemo(() => {
    const w = selectedNode?.dimensions?.width || params.width || 1024;
    const h = selectedNode?.dimensions?.height || params.height || 1024;
    const outW = w * topazFactor;
    const outH = h * topazFactor;
    const mp = (outW * outH) / 1_000_000;
    const cost = costTopazUpscale(topazFactor, false, w * h, mp);
    return { w, h, outW, outH, mp, cost };
  }, [selectedNode?.dimensions, params.width, params.height, topazFactor]);

  const isTrial = useAIConfigStore((state) => state.isTrial);
  const prunaMode = params.prunaMode ?? 'target';
  const prunaFactor = params.prunaFactor ?? params.upscaleFactor ?? 2;
  const prunaTarget = params.prunaTarget ?? 4;
  const prunaDims = useMemo(() => {
    const w = selectedNode?.dimensions?.width || params.width || 1024;
    const h = selectedNode?.dimensions?.height || params.height || 1024;
    let outW = w;
    let outH = h;
    let mp = prunaTarget;
    if (prunaMode === 'factor') {
      outW = w * prunaFactor;
      outH = h * prunaFactor;
      mp = (outW * outH) / 1_000_000;
    } else {
      const scale = Math.sqrt((prunaTarget * 1_000_000) / (w * h));
      outW = Math.round(w * scale);
      outH = Math.round(h * scale);
      mp = prunaTarget;
    }
    const cost = costPrunaUpscale(prunaTarget, isTrial, prunaMode, prunaFactor, w * h, mp);
    return { w, h, outW, outH, mp, cost };
  }, [selectedNode?.dimensions, params.width, params.height, prunaMode, prunaFactor, prunaTarget, isTrial]);

  const anarchyScale = params.anarchyUpscaleScale ?? config.anarchyUpscaleScale ?? params.upscaleFactor ?? 2;
  const anarchyDims = useMemo(() => {
    const w = selectedNode?.dimensions?.width || params.width || 1024;
    const h = selectedNode?.dimensions?.height || params.height || 1024;
    const outW = w * anarchyScale;
    const outH = h * anarchyScale;
    const rawMp = (outW * outH) / 1_000_000;
    const mp = Math.min(64, rawMp);
    const cost = costAnarchyUpscale(anarchyScale, isTrial, w * h, mp);
    return { w, h, outW, outH, mp, cost };
  }, [selectedNode?.dimensions, params.width, params.height, anarchyScale, isTrial]);

  const availableEngines = useMemo(() => {
    return ENGINES.filter(engine => {
      if (engine.tool !== selectedTool) return false;
      if (selectedTool === 'image-editor' && studioModeForFilter === 'edit' && engine.generateOnly) {
        return false;
      }
      return true;
    });
  }, [selectedTool, studioModeForFilter]);

  const isGpt25 = selectedModel === 'openai/gpt-image-2.5-flare' || selectedModel === 'openai/gpt-image-2.5-sunburst';
  const isMidjourney = (selectedModel as string)?.startsWith('midjourney/');
  const isMjFast = (selectedModel as string).includes('mj-fast') || (selectedModel as string).includes('fast');
  const isMjCreative = (selectedModel as string).includes('creative');
  const isMjSubtle = (selectedModel as string).includes('subtle');
  const mjStyle: 'standard' | 'subtle' | 'creative' = isMjCreative ? 'creative' : isMjSubtle ? 'subtle' : 'standard';
  const mjMode: 'turbo' | 'fast' = isMjFast ? 'fast' : 'turbo';

  const switchMjModel = (newMode: 'turbo' | 'fast', newStyle: 'standard' | 'subtle' | 'creative') => {
    let target = 'midjourney/mj-turbo-upscale';
    if (newMode === 'turbo') {
      if (newStyle === 'subtle') target = 'midjourney/mj-turbo-upscale-subtle';
      else if (newStyle === 'creative') target = 'midjourney/mj-turbo-upscale-creative';
      else target = 'midjourney/mj-turbo-upscale';
    } else {
      if (newStyle === 'subtle') target = 'midjourney/mj-fast-upscale-subtle';
      else if (newStyle === 'creative') target = 'midjourney/mj-fast-upscale-creative';
      else target = 'midjourney/mj-fast-upscale';
    }
    onModelChange(target as any);
    setConfig(prev => ({ ...prev, model: target as any }));
    if (newStyle !== 'standard') {
      onParamsChange({ ...params, upscaleFactor: 2 });
    }
  };

  const selectedEngine = availableEngines.find(e => 
    e.id === selectedModel || 
    (isGpt25 && e.id === 'openai/gpt-image-2.5-flare') ||
    (isMidjourney && e.id === 'midjourney/mj-turbo-upscale')
  ) || availableEngines[0] || ENGINES[0];
  
  // Get model-specific settings
  const modelSettings = useMemo(() => replicateService.getModelSettings(selectedModel), [selectedModel]);
  
  // Filter available resolutions and aspect ratios based on model
  const availableResolutions = modelSettings.resolutions;
  const availableAspectRatios = modelSettings.aspectRatios;

  // Auto-adjust params when model changes
  useEffect(() => {
    const updates: Partial<typeof params> = {};
    
    // Only adjust resolution if model actually provides a non-empty list of supported resolutions
    if (
      availableResolutions && 
      availableResolutions.length > 0 && 
      params.resolution && 
      !availableResolutions.includes(params.resolution)
    ) {
      const nextRes = availableResolutions[0] ?? 'Auto';
      if (nextRes !== params.resolution) {
        updates.resolution = nextRes;
      }
    }
    
    // Only adjust aspect ratio if model actually provides a non-empty list of supported aspect ratios
    if (selectedModel === 'black-forest-labs/flux-3-image') {
      if (!params.aspectRatio || params.aspectRatio === '1:1' || params.aspectRatio === 'match_input_image' || !availableAspectRatios.includes(params.aspectRatio)) {
        if (params.aspectRatio !== 'auto') {
          updates.aspectRatio = 'auto';
        }
      }
    } else if (
      availableAspectRatios && 
      availableAspectRatios.length > 0 && 
      params.aspectRatio && 
      !availableAspectRatios.includes(params.aspectRatio)
    ) {
      const nextAspect = availableAspectRatios.includes('1:1') ? '1:1' : (availableAspectRatios[0] ?? '1:1');
      if (nextAspect !== params.aspectRatio) {
        updates.aspectRatio = nextAspect;
      }
    }

    if (selectedModel === 'bytedance/seedance-2.0') {
      const dur = params.videoDuration != null ? Number(String(params.videoDuration).replace('s', '')) : 5;
      if (dur !== -1 && (dur < 4 || dur > 15)) {
        if (params.videoDuration !== '5') {
          updates.videoDuration = '5';
        }
      }
    }
    
    if (Object.keys(updates).length > 0) {
      onParamsChange({ ...params, ...updates });
    }
  }, [selectedModel, availableResolutions, availableAspectRatios, modelSettings, onParamsChange]);

  const selectedModelRef = useRef(selectedModel);
  selectedModelRef.current = selectedModel;
  
  useEffect(() => {
    if (availableEngines.length > 0 && !availableEngines.some(engine => 
      engine.id === selectedModelRef.current || 
      (engine.id === 'openai/gpt-image-2.5-flare' && selectedModelRef.current === 'openai/gpt-image-2.5-sunburst') ||
      (engine.id === 'midjourney/mj-turbo-upscale' && (selectedModelRef.current as string)?.startsWith('midjourney/'))
    )) {
      onModelChange(availableEngines[0].id as ReplicateImageModel | ReplicateUpscaleModel | ReplicateVideoModel);
    }
  }, [selectedTool, availableEngines, onModelChange]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const closeAll = () => {
      setShowToolDropdown(false);
      setShowEngineDropdown(false);
      setShowResDropdown(false);
      setShowAspectDropdown(false);
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
  const supportsUpscaleFactor = (selectedModel as string) === 'prunaai/p-image-upscale';
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
                  if (tool.id !== selectedTool) {
                    setConfig(prev => ({
                      ...prev,
                      selectedTool: tool.id,
                      ...(tool.id !== 'image-editor' ? { studioMode: 'edit' } : {})
                    }));
                    const enginesForTool = ENGINES.filter(e => e.tool === tool.id);
                    if (enginesForTool.length > 0 && !enginesForTool.some(e => e.id === selectedModel)) {
                      onModelChange(enginesForTool[0].id);
                    }
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
            {availableEngines.map(engine => {
              const isEngineActive = 
                selectedModel === engine.id || 
                (isGpt25 && engine.id === 'openai/gpt-image-2.5-flare') ||
                (isMidjourney && engine.id === 'midjourney/mj-turbo-upscale');
              return (
                <div 
                  key={engine.id}
                  className={`dropdown-item engine-item ${isEngineActive ? 'active' : ''}`}
                  onClick={() => {
                    if (engine.id === 'openai/gpt-image-2.5-flare') {
                      const targetModel = config.gptVariant === 'sunburst' ? 'openai/gpt-image-2.5-sunburst' : 'openai/gpt-image-2.5-flare';
                      onModelChange(targetModel as ReplicateImageModel);
                    } else if (engine.id === 'midjourney/mj-turbo-upscale') {
                      const targetModel = isMidjourney ? selectedModel : 'midjourney/mj-turbo-upscale';
                      onModelChange(targetModel as any);
                    } else {
                      onModelChange(engine.id as ReplicateImageModel | ReplicateUpscaleModel | ReplicateVideoModel);
                    }
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
                  {isEngineActive && (
                    <Check size={14} color="#e11d48" />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* GPT 2.5 Variant Selector (flare / sunburst) & Quality Selector */}
        {isGpt25 && (
          <div className="gpt-variant-selector-wrapper">
            <div className="gpt-variant-pill">
              <button
                type="button"
                className={`gpt-variant-btn ${selectedModel === 'openai/gpt-image-2.5-flare' ? 'active' : ''}`}
                onClick={() => {
                  onModelChange('openai/gpt-image-2.5-flare');
                  setConfig(prev => ({ ...prev, gptVariant: 'flare' }));
                }}
                title="GPT Image 2.5 Flare"
              >
                <Flame size={13} className="gpt-variant-icon" />
                <span>flare</span>
              </button>
              <button
                type="button"
                className={`gpt-variant-btn ${selectedModel === 'openai/gpt-image-2.5-sunburst' ? 'active' : ''}`}
                onClick={() => {
                  onModelChange('openai/gpt-image-2.5-sunburst');
                  setConfig(prev => ({ ...prev, gptVariant: 'sunburst' }));
                }}
                title="GPT Image 2.5 Sunburst"
              >
                <Sun size={13} className="gpt-variant-icon" />
                <span>sunburst</span>
              </button>
            </div>

            {/* Quality Tier Selector */}
            <div className="gpt-quality-selector-wrapper">
              <div className="gpt-quality-pill">
                {(['auto', 'low', 'medium', 'high', 'xhigh', 'max'] as const).map(q => {
                  const currentQuality = (params as any).gptQuality || config.gptQuality || 'auto';
                  const isCurrent = currentQuality === q;
                  const qCost = getModelCost(selectedModel, {
                    qualityVariant: q,
                  });
                  return (
                    <button
                      key={q}
                      type="button"
                      className={`gpt-quality-btn ${isCurrent ? 'active' : ''}`}
                      onClick={() => {
                        onParamsChange({ ...params, gptQuality: q, qualityVariant: q });
                        setConfig(prev => ({ ...prev, gptQuality: q, qualityVariant: q }));
                      }}
                      title={`Quality: ${q} (${qCost} cr)`}
                    >
                      {q}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Midjourney Variant (Turbo / Fast) & Style Selector (Standard / Subtle / Creative) - Styled like GPT 2.5 */}
        {isMidjourney && (
          <div className="gpt-variant-selector-wrapper">
            {/* Speed: Turbo / Fast */}
            <div className="gpt-variant-pill">
              <button
                type="button"
                className={`gpt-variant-btn mj-variant-btn ${mjMode === 'turbo' ? 'active' : ''}`}
                onClick={() => switchMjModel('turbo', mjStyle)}
                title="Midjourney Turbo (3–5s)"
              >
                <Zap size={13} className="gpt-variant-icon" />
                <span>turbo</span>
              </button>
              <button
                type="button"
                className={`gpt-variant-btn mj-variant-btn ${mjMode === 'fast' ? 'active' : ''}`}
                onClick={() => switchMjModel('fast', mjStyle)}
                title="Midjourney Fast (15–30s)"
              >
                <Clock size={13} className="gpt-variant-icon" />
                <span>fast</span>
              </button>
            </div>

            {/* Style: Standard / Subtle / Creative */}
            <div className="gpt-quality-selector-wrapper">
              <div className="gpt-quality-pill">
                {(['standard', 'subtle', 'creative'] as const).map(s => {
                  const isCurrent = mjStyle === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      className={`gpt-quality-btn mj-quality-btn ${isCurrent ? 'active' : ''}`}
                      onClick={() => switchMjModel(mjMode, s)}
                      title={`Style: ${s}`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {isUpscalingTool ? (
        <>
          {(selectedModel as string) !== 'topazlabs/image-upscale' &&
           (selectedModel as string) !== 'philz1337x/clarity-upscaler' &&
           !(selectedModel as string).startsWith('midjourney/') && (
            <div className="control-section">
              <label className="section-label">Upscale Factor</label>
              {supportsUpscaleFactor ? (
                <>
                  <div className="upscale-factor-row">
                    {UPSCALE_FACTORS.map(factor => {
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
                  {(selectedModel as string) === 'prunaai/p-image-upscale' && (
                    <>
                      <div style={{ marginTop: '6px', fontSize: '11px', color: '#94a3b8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Output: ~{prunaDims.mp.toFixed(1)} MP ({params.prunaMode === 'target' ? `${params.prunaTarget ?? 4} MP Target` : `${params.prunaFactor ?? params.upscaleFactor ?? 2}x Scale`})</span>
                        <span style={{ color: '#e11d48', fontWeight: 700 }}>{prunaDims.cost} {prunaDims.cost === 1 ? 'Credit' : 'Credits'}</span>
                      </div>
                      <span className="param-hint">Pruna AI tiers: 1-4MP (0.2cr) · 4-8MP (0.4cr) · 8-16MP (0.6cr) · 16-32MP (0.8cr) · 32-64MP (1.25cr) · 64-128MP (2.5cr)</span>
                    </>
                  )}
                </>
              ) : (
                <div className="upscale-fixed-note">This engine uses a fixed upscale level.</div>
              )}
            </div>
          )}
          
          <UpscalerSettingsSection
            selectedModel={selectedModel as string}
            params={params}
            updateParam={updateParam}
            onParamsChange={onParamsChange}
            topazDims={topazDims}
            prunaDims={prunaDims}
            anarchyDims={anarchyDims}
          />
        </>
      ) : (
        <div className="control-row">
          {/* Resolution / Quality (Hidden for GPT 2.5: quality is in the quality pill & dimensions are in Aspect Ratio) */}
          {!isGpt25 && availableResolutions && availableResolutions.length > 0 && (
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
                  {availableResolutions.map(res => {
                    const itemCost = getModelCost(selectedModel, {
                      resolution: res,
                      qualityVariant: (params as any).gptQuality || (params as any).qualityVariant || (selectedModel === 'openai/gpt-image-2' ? res : undefined),
                    });
                    return (
                      <div 
                        key={res}
                        className={`dropdown-item ${params.resolution === res ? 'active' : ''}`}
                        onClick={() => {
                          if (selectedModel === 'openai/gpt-image-2') {
                            onParamsChange({ ...params, resolution: res, qualityVariant: res, gptQuality: res });
                          } else {
                            updateParam('resolution', res);
                          }
                          setShowResDropdown(false);
                        }}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        <span>{res}</span>
                        <span style={{ fontSize: '11px', opacity: 0.65, marginLeft: '8px', color: '#94a3b8' }}>
                          {itemCost} cr
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Aspect Ratio */}
          <div className="control-half" ref={aspectDropdownRef}>
            <label className="section-label">Aspect ratio</label>
            <div 
              className="dropdown-trigger"
              onClick={() => setShowAspectDropdown(!showAspectDropdown)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <AspectRatioIcon ratio={params.aspectRatio || '1:1'} size={16} />
                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {params.aspectRatio === 'match_input_image' ? 'match input image' : (params.aspectRatio || '1:1')}
                </span>
              </div>
              <ChevronDown size={16} />
            </div>
            {showAspectDropdown && (
              <div className="dropdown-menu small-menu">
                {availableAspectRatios.map(ratio => {
                  const hint = ratio === 'match_input_image' ? 'Auto Match' : getAspectRatioHint(ratio);
                  const isSelected = params.aspectRatio === ratio;
                  return (
                    <div 
                      key={ratio}
                      className={`dropdown-item ${isSelected ? 'active' : ''}`}
                      onClick={() => {
                        updateParam('aspectRatio', ratio);
                        setShowAspectDropdown(false);
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: '9px' }}
                    >
                      <AspectRatioIcon ratio={ratio} size={16} active={isSelected} />
                      <span style={{ fontWeight: 500 }}>
                        {ratio === 'match_input_image' ? 'match input image' : ratio}
                      </span>
                      {hint && (
                        <span style={{ fontSize: '10.5px', opacity: 0.5, marginLeft: 'auto' }}>
                          {hint}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Video Creator specific advanced controls */}
      <VideoSettingsSection
        selectedModel={selectedModel as string}
        params={params}
        updateParam={updateParam}
      />

      {/* Anarchy Creator (Reve AI) Advanced Controls */}
      <AnarchyCreatorSection
        selectedTool={selectedTool}
        selectedModel={selectedModel as string}
        params={params}
        updateParam={updateParam}
      />

      {/* General Generation Parameters */}
      <GeneralParamsSection
        params={params}
        updateParam={updateParam}
        selectedEngine={selectedEngine}
        selectedModel={selectedModel as string}
        isUpscalingTool={isUpscalingTool}
        modelSettings={modelSettings}
        seqDropdownRef={seqDropdownRef}
        styleTypeDropdownRef={styleTypeDropdownRef}
        stylePresetDropdownRef={stylePresetDropdownRef}
      />
    </div>
  );
};

export default AIControlPanel;
