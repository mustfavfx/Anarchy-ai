/**
 * AI Control Panel - Clean Professional Modular Architecture
 * Tool → Engine → Resolution → Aspect Ratio flow
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  ChevronDown, Check, Wand2, Sparkles, Flame, Sun
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
  
  // Initialize selectedTool from config, but only once on mount
  const initialToolRef = useRef<ToolType>(config.selectedTool || 'image-editor');
  const [selectedTool, setSelectedTool] = useState<ToolType>(initialToolRef.current);
  const [showToolDropdown, setShowToolDropdown] = useState(false);
  const [showEngineDropdown, setShowEngineDropdown] = useState(false);
  const [showResDropdown, setShowResDropdown] = useState(false);
  const [showAspectDropdown, setShowAspectDropdown] = useState(false);

  // Ref to track previous tool value
  const prevSelectedToolRef = useRef<ToolType>(selectedTool);
  
  // Sync external config changes to local state (when config changes from outside)
  useEffect(() => {
    if (config.selectedTool !== selectedTool) {
      setSelectedTool(config.selectedTool);
      prevSelectedToolRef.current = config.selectedTool;
    }
  }, [config.selectedTool, selectedTool]);
  
  // Sync selectedTool to AIConfigContext - only when local tool changes
  useEffect(() => {
    if (prevSelectedToolRef.current !== selectedTool) {
      prevSelectedToolRef.current = selectedTool;
      setConfig(prev => ({ 
        ...prev, 
        selectedTool,
        ...(selectedTool !== 'image-editor' ? { studioMode: 'edit' } : {})
      }));
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
  const selectedEngine = availableEngines.find(e => e.id === selectedModel || (isGpt25 && e.id === 'openai/gpt-image-2.5-flare')) || availableEngines[0] || ENGINES[0];
  
  // Get model-specific settings
  const modelSettings = useMemo(() => replicateService.getModelSettings(selectedModel), [selectedModel]);
  
  // Filter available resolutions and aspect ratios based on model
  const availableResolutions = modelSettings.resolutions;
  const availableAspectRatios = modelSettings.aspectRatios;

  // Auto-adjust params when model changes
  useEffect(() => {
    const updates: Partial<typeof params> = {};
    
    if (params.resolution && !availableResolutions.includes(params.resolution)) {
      updates.resolution = availableResolutions[0] ?? 'Auto';
    }
    
    if (params.aspectRatio && !availableAspectRatios.includes(params.aspectRatio)) {
      updates.aspectRatio = availableAspectRatios[0] ?? '1:1';
    }

    if (selectedModel === 'bytedance/seedance-2.0') {
      const dur = params.videoDuration != null ? Number(String(params.videoDuration).replace('s', '')) : 5;
      if (dur !== -1 && (dur < 4 || dur > 15)) {
        updates.videoDuration = '5';
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
      (engine.id === 'openai/gpt-image-2.5-flare' && selectedModelRef.current === 'openai/gpt-image-2.5-sunburst')
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
                  setSelectedTool(tool.id);
                  if (tool.id !== 'image-editor') {
                    setConfig(prev => ({ ...prev, studioMode: 'edit' }));
                  }
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
            {availableEngines.map(engine => {
              const isEngineActive = selectedModel === engine.id || (isGpt25 && engine.id === 'openai/gpt-image-2.5-flare');
              return (
                <div 
                  key={engine.id}
                  className={`dropdown-item engine-item ${isEngineActive ? 'active' : ''}`}
                  onClick={() => {
                    if (engine.id === 'openai/gpt-image-2.5-flare') {
                      const targetModel = config.gptVariant === 'sunburst' ? 'openai/gpt-image-2.5-sunburst' : 'openai/gpt-image-2.5-flare';
                      onModelChange(targetModel as ReplicateImageModel);
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

        {/* GPT 2.5 Variant Selector (flare / sunburst) */}
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
          </div>
        )}
      </div>

      {isUpscalingTool ? (
        <>
          {(selectedModel as string) !== 'topazlabs/image-upscale' &&
           (selectedModel as string) !== 'philz1337x/clarity-upscaler' &&
           (selectedModel as string) !== 'philz1337x/clarity-pro-upscaler' && (
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
          {/* Resolution / Quality */}
          <div className="control-half" ref={resDropdownRef}>
            <label className="section-label">
              {(selectedModel === 'openai/gpt-image-2' || isGpt25) ? 'Quality' : 'Resolution'}
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
                    qualityVariant: res,
                  });
                  return (
                    <div 
                      key={res}
                      className={`dropdown-item ${params.resolution === res ? 'active' : ''}`}
                      onClick={() => {
                        if (selectedModel === 'openai/gpt-image-2' || isGpt25) {
                          onParamsChange({ ...params, resolution: res, qualityVariant: res, gptQuality: res });
                          if (isGpt25) {
                            setConfig(prev => ({ ...prev, gptQuality: res as any }));
                          }
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
