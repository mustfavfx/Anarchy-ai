import React from 'react';
import { Sparkles, Layers } from 'lucide-react';
import { type AIControlPanelProps, type ToolType, PanelSelect } from './panelTypes';

export interface AnarchyCreatorSectionProps {
  selectedTool: ToolType;
  selectedModel: string;
  params: AIControlPanelProps['params'];
  updateParam: (key: keyof AIControlPanelProps['params'], value: any) => void;
}

export const AnarchyCreatorSection: React.FC<AnarchyCreatorSectionProps> = ({
  selectedTool,
  selectedModel,
  params,
  updateParam,
}) => {
  if (selectedTool !== 'anarchy-creator') return null;

  return (
    <>
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
                onChange={(v: string) => updateParam('anarchyEffect', v)}
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
                    title="Click to copy frame reference"
                    aria-label="Click to copy frame reference"
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

    </>
  );
};
