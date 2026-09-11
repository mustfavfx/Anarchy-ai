import React from 'react';
import { costClarityUpscale } from '../../../services/credit/creditService';
import { useAIConfigStore } from '../../../stores/aiConfigStore';
import { PanelSelect } from './panelTypes';
import type { AIControlPanelProps } from './panelTypes';

export interface UpscalerSettingsSectionProps {
  selectedModel: string;
  params: AIControlPanelProps['params'];
  updateParam: (key: keyof AIControlPanelProps['params'], value: any) => void;
  onParamsChange: (params: AIControlPanelProps['params']) => void;
  topazDims: { w: number; h: number; outW: number; outH: number; mp: number; cost: number };
  prunaDims: { w: number; h: number; outW: number; outH: number; mp: number; cost: number };
  anarchyDims: { w: number; h: number; outW: number; outH: number; mp: number; cost: number };
}

export const UpscalerSettingsSection: React.FC<UpscalerSettingsSectionProps> = ({
  selectedModel,
  params,
  updateParam,
  onParamsChange,
  topazDims,
  prunaDims,
  anarchyDims,
}) => {
  const config = useAIConfigStore((state) => state.config);
  const setConfig = useAIConfigStore((state) => state.setConfig);

  return (
    <>
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
                <div style={{ marginTop: '6px', fontSize: '11px', color: '#94a3b8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Clarity Scale: {params.clarityScale ?? 2}x (Nvidia A100)</span>
                  <span style={{ color: '#e11d48', fontWeight: 700 }}>{costClarityUpscale(params.clarityScale ?? 2)} Credits</span>
                </div>
                <span className="param-hint">Nvidia A100 GPU compute: 2x (3cr) · 4x (10cr) · 8x (20cr) · 12x (30cr)</span>
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
                <div style={{ marginTop: '6px', fontSize: '11px', color: '#94a3b8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Output: ~{topazDims.mp.toFixed(1)} MP ({topazDims.outW}×{topazDims.outH})</span>
                  <span style={{ color: '#e11d48', fontWeight: 700 }}>{topazDims.cost} {topazDims.cost === 1 ? 'Credit' : 'Credits'}</span>
                </div>
                <span className="param-hint">Dynamic pricing aligned with Replicate megapixels</span>
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
                  <div style={{ marginTop: '4px', fontSize: '11px', color: '#94a3b8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Target: {params.prunaTarget ?? 4} Megapixels (~{prunaDims.outW}×{prunaDims.outH})</span>
                    <span style={{ color: '#e11d48', fontWeight: 700 }}>{prunaDims.cost} {prunaDims.cost === 1 ? 'Credit' : 'Credits'}</span>
                  </div>
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
                  <div style={{ marginTop: '4px', fontSize: '11px', color: '#94a3b8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Output: ~{prunaDims.mp.toFixed(1)} MP ({prunaDims.outW}×{prunaDims.outH})</span>
                    <span style={{ color: '#e11d48', fontWeight: 700 }}>{prunaDims.cost} {prunaDims.cost === 1 ? 'Credit' : 'Credits'}</span>
                  </div>
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
            </>
          )}

          {/* Anarchy Upscale (Clarity Pro) Settings */}
          {(selectedModel as string) === 'philz1337x/clarity-pro-upscaler' && (
            <>
              {/* Scale Factor */}
              <div className="control-section">
                <label className="section-label">Scale Factor</label>
                <div className="upscale-factor-row">
                  {[2, 4, 8, 16].map(factor => (
                    <button
                      key={factor}
                      type="button"
                      className={`upscale-factor-btn ${(params.anarchyUpscaleScale ?? 2) === factor ? 'active' : ''}`}
                      onClick={() => updateParam('anarchyUpscaleScale', factor)}
                    >
                      {factor}x
                    </button>
                  ))}
                </div>
                <div style={{ marginTop: '6px', fontSize: '11px', color: '#94a3b8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Output: ~{anarchyDims.outW}×{anarchyDims.outH} (~{anarchyDims.mp.toFixed(1)} MP{anarchyDims.mp >= 64 ? ' max' : ''})</span>
                  <span style={{ color: '#e11d48', fontWeight: 700 }}>{anarchyDims.cost} Credits</span>
                </div>
                <span className="param-hint">$0.03 per million output image pixels (capped at 64 MP)</span>
              </div>

              {/* Creativity Slider */}
              <div className="control-section">
                <div className="param-header">
                  <label className="section-label">Creativity</label>
                  <span className="param-value">{params.anarchyUpscaleCreativity ?? 4}</span>
                </div>
                <input
                  type="range"
                  min="-10"
                  max="10"
                  step="1"
                  value={params.anarchyUpscaleCreativity ?? 4}
                  onChange={(e) => updateParam('anarchyUpscaleCreativity', Number.parseInt(e.target.value))}
                  className="param-slider"
                />
                <span className="param-hint">
                  Creativity level for upscaling. Negative values stay closer to the original image; positive values let the model add more detail. (Default: 4)
                </span>
              </div>
            </>
          )}
        </>
  );
};
