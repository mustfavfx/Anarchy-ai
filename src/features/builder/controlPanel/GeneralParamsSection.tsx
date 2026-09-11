import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { replicateService, type ReplicateModel } from '../../../services/replicate';
import type { AIControlPanelProps, Engine } from './panelTypes';

export interface GeneralParamsSectionProps {
  params: AIControlPanelProps['params'];
  updateParam: (key: keyof AIControlPanelProps['params'], value: any) => void;
  selectedEngine: Engine;
  selectedModel: string;
  isUpscalingTool: boolean;
  modelSettings: any;
  seqDropdownRef: React.RefObject<HTMLDivElement | null>;
  styleTypeDropdownRef: React.RefObject<HTMLDivElement | null>;
  stylePresetDropdownRef: React.RefObject<HTMLDivElement | null>;
}

export const GeneralParamsSection: React.FC<GeneralParamsSectionProps> = ({
  params,
  updateParam,
  selectedEngine,
  selectedModel,
  isUpscalingTool,
  modelSettings,
  seqDropdownRef,
  styleTypeDropdownRef,
  stylePresetDropdownRef,
}) => {
  const [showSeqDropdown, setShowSeqDropdown] = useState(false);
  const [showStyleTypeDropdown, setShowStyleTypeDropdown] = useState(false);
  const [showStylePresetDropdown, setShowStylePresetDropdown] = useState(false);

  return (
    <>
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
      {!isUpscalingTool && replicateService.getModelCapabilities(selectedModel as ReplicateModel).supportsReferenceStrength && (
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
    </>
  );
};
