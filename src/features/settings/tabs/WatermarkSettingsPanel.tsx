import React, { useState, useRef } from 'react';
import { FileText, Upload } from 'lucide-react';
import { useAIConfigStore, type WatermarkPosition } from '../../../stores/aiConfigStore';

export const WatermarkSettingsPanel: React.FC = () => {
  const aiConfig = useAIConfigStore((s) => s.config);
  const setAIConfig = useAIConfigStore((s) => s.setConfig);
  const [activeWmSlot, setActiveWmSlot] = useState<'wm1' | 'wm2'>('wm1');

  const watermarkFileInputRef = useRef<HTMLInputElement>(null);
  const watermark2FileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="settings-card wm-card">
      <div className="settings-card-header">
        <FileText size={18} className="card-icon" />
        <div>
          <h3>Watermark Settings</h3>
          <p className="card-desc">Add up to 2 customizable watermarks (logos or text) with live positioning</p>
        </div>
        <div className="wm-header-toggle">
          <button
            className={`toggle-switch ${(aiConfig.enableWatermark || aiConfig.enableWatermark2) ? 'on' : ''}`}
            title="Toggle all watermarks"
            onClick={() => {
              const anyActive = aiConfig.enableWatermark || aiConfig.enableWatermark2;
              if (anyActive) {
                setAIConfig(prev => ({ ...prev, enableWatermark: false, enableWatermark2: false }));
              } else {
                setAIConfig(prev => ({ ...prev, enableWatermark: true }));
              }
            }}
          />
        </div>
      </div>

      {(aiConfig.enableWatermark || aiConfig.enableWatermark2) && (
        <div className="wm-body">

          {/* Top Bar: Dual Watermark Slot Switcher */}
          <div className="wm-slot-nav">
            <button
              type="button"
              className={`wm-slot-btn ${activeWmSlot === 'wm1' ? 'active' : ''}`}
              onClick={() => setActiveWmSlot('wm1')}
            >
              <span className="wm-slot-title">Watermark 1 (Primary)</span>
              <span className={`wm-slot-status ${aiConfig.enableWatermark ? 'enabled' : 'disabled'}`}>
                {aiConfig.enableWatermark ? 'ON' : 'OFF'}
              </span>
            </button>

            <button
              type="button"
              className={`wm-slot-btn ${activeWmSlot === 'wm2' ? 'active' : ''}`}
              onClick={() => setActiveWmSlot('wm2')}
            >
              <span className="wm-slot-title">Watermark 2 (Secondary)</span>
              <span className={`wm-slot-status ${aiConfig.enableWatermark2 ? 'enabled' : 'disabled'}`}>
                {aiConfig.enableWatermark2 ? 'ON' : 'OFF'}
              </span>
            </button>
          </div>

          {/* 2-Column Split: Controls (Left) & Live Preview (Right) */}
          <div className="wm-grid-layout">

            {/* LEFT COLUMN: Controls */}
            <div className="wm-controls-col">

              {/* SLOT 1 PANE */}
              {activeWmSlot === 'wm1' && (
                <div className="wm-slot-pane">
                  <div className="wm-slot-header-row">
                    <span className="wm-pane-label">Watermark 1 Settings</span>
                    <label className="wm-sub-toggle">
                      <input
                        type="checkbox"
                        checked={aiConfig.enableWatermark}
                        onChange={e => setAIConfig(prev => ({ ...prev, enableWatermark: e.target.checked }))}
                      />
                      <span>Enable Slot 1</span>
                    </label>
                  </div>

                  {aiConfig.enableWatermark && (
                    <>
                      {/* Type selector */}
                      <div className="wm-type-tabs">
                        <button
                          type="button"
                          className={`wm-type-tab ${(aiConfig.watermarkType || 'text') === 'text' ? 'active' : ''}`}
                          onClick={() => setAIConfig(prev => ({ ...prev, watermarkType: 'text' }))}
                        >
                          <span className="wm-tab-icon">T</span> Text
                        </button>
                        <button
                          type="button"
                          className={`wm-type-tab ${aiConfig.watermarkType === 'image' ? 'active' : ''}`}
                          onClick={() => setAIConfig(prev => ({ ...prev, watermarkType: 'image' }))}
                        >
                          <span className="wm-tab-icon">🖼</span> Image Logo (PNG)
                        </button>
                      </div>

                      {/* Text mode */}
                      {(aiConfig.watermarkType || 'text') === 'text' && (
                        <div className="wm-section">
                          <label className="wm-label">Text Content (Enter for new line)</label>
                          <textarea
                            className="wm-input wm-textarea"
                            rows={2}
                            value={aiConfig.watermarkText || ''}
                            onChange={e => setAIConfig(prev => ({ ...prev, watermarkText: e.target.value }))}
                            placeholder="e.g. © Mustafa Hisham&#10;+964 781 163 7027"
                          />
                        </div>
                      )}

                      {/* Image mode */}
                      {aiConfig.watermarkType === 'image' && (
                        <div className="wm-section">
                          <label className="wm-label">PNG Logo / Signature</label>
                          <input
                            type="file"
                            ref={watermarkFileInputRef}
                            accept="image/png,image/svg+xml,image/*"
                            onChange={(ev) => {
                              const f = ev.target.files?.[0];
                              if (!f) return;
                              const reader = new FileReader();
                              reader.onload = (e) => setAIConfig(prev => ({ ...prev, watermarkImage: e.target?.result as string }));
                              reader.readAsDataURL(f);
                              ev.target.value = '';
                            }}
                            style={{ display: 'none' }}
                          />
                          <div className="wm-image-upload" onClick={() => watermarkFileInputRef.current?.click()}>
                            {aiConfig.watermarkImage ? (
                              <div className="wm-image-preview-wrap">
                                <img src={aiConfig.watermarkImage} className="wm-image-preview" alt="watermark 1" />
                                <button type="button" className="wm-image-remove" onClick={e => { e.stopPropagation(); setAIConfig(prev => ({ ...prev, watermarkImage: '' })); }}>✕</button>
                              </div>
                            ) : (
                              <div className="wm-image-placeholder">
                                <Upload size={18} />
                                <span>Click to upload PNG Logo</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Position 9-Grid */}
                      <div className="wm-section">
                        <label className="wm-label">Position</label>
                        <div className="wm-position-grid">
                          {[
                            { v: 'top-left', label: '↖ Top Left' }, { v: 'top-center', label: '↑ Center' }, { v: 'top-right', label: '↗ Top Right' },
                            { v: 'center', label: '· Center' },
                            { v: 'bottom-left', label: '↙ Bottom Left' }, { v: 'bottom-center', label: '↓ Center' }, { v: 'bottom-right', label: '↘ Bottom Right' },
                          ].map(p => (
                            <button
                              key={p.v}
                              type="button"
                              className={`wm-pos-btn ${(aiConfig.watermarkPosition || 'bottom-right') === p.v ? 'active' : ''}`}
                              onClick={() => setAIConfig(prev => ({ ...prev, watermarkPosition: p.v as WatermarkPosition }))}
                            >{p.label}</button>
                          ))}
                        </div>
                      </div>

                      {/* Sliders in a tight row */}
                      <div className="wm-sliders-compact">
                        <div className="wm-slider-item">
                          <div className="wm-slider-header">
                            <span className="wm-label">Opacity</span>
                            <span className="wm-slider-val">{((aiConfig.watermarkOpacity ?? 0.5) * 100).toFixed(0)}%</span>
                          </div>
                          <input type="range" min="0.05" max="1" step="0.05"
                            className="wm-slider"
                            value={aiConfig.watermarkOpacity ?? 0.5}
                            onChange={e => setAIConfig(prev => ({ ...prev, watermarkOpacity: Number.parseFloat(e.target.value) }))}
                          />
                        </div>

                        {(aiConfig.watermarkType || 'text') === 'text' ? (
                          <div className="wm-slider-item">
                            <div className="wm-slider-header">
                              <span className="wm-label">Font Size</span>
                              <span className="wm-slider-val">{aiConfig.watermarkFontSize || 24}px</span>
                            </div>
                            <input type="range" min="12" max="96" step="2"
                              className="wm-slider"
                              value={aiConfig.watermarkFontSize || 24}
                              onChange={e => setAIConfig(prev => ({ ...prev, watermarkFontSize: Number.parseInt(e.target.value) }))}
                            />
                          </div>
                        ) : (
                          <div className="wm-slider-item">
                            <div className="wm-slider-header">
                              <span className="wm-label">Image Size</span>
                              <span className="wm-slider-val">{aiConfig.watermarkImageSize || 20}%</span>
                            </div>
                            <input type="range" min="5" max="80" step="5"
                              className="wm-slider"
                              value={aiConfig.watermarkImageSize || 20}
                              onChange={e => setAIConfig(prev => ({ ...prev, watermarkImageSize: Number.parseInt(e.target.value) }))}
                            />
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* SLOT 2 PANE */}
              {activeWmSlot === 'wm2' && (
                <div className="wm-slot-pane">
                  <div className="wm-slot-header-row">
                    <span className="wm-pane-label">Watermark 2 Settings</span>
                    <label className="wm-sub-toggle">
                      <input
                        type="checkbox"
                        checked={!!aiConfig.enableWatermark2}
                        onChange={e => setAIConfig(prev => ({ ...prev, enableWatermark2: e.target.checked }))}
                      />
                      <span>Enable Slot 2</span>
                    </label>
                  </div>

                  {aiConfig.enableWatermark2 ? (
                    <>
                      {/* Type selector */}
                      <div className="wm-type-tabs">
                        <button
                          type="button"
                          className={`wm-type-tab ${(aiConfig.watermark2Type || 'text') === 'text' ? 'active' : ''}`}
                          onClick={() => setAIConfig(prev => ({ ...prev, watermark2Type: 'text' }))}
                        >
                          <span className="wm-tab-icon">T</span> Text
                        </button>
                        <button
                          type="button"
                          className={`wm-type-tab ${aiConfig.watermark2Type === 'image' ? 'active' : ''}`}
                          onClick={() => setAIConfig(prev => ({ ...prev, watermark2Type: 'image' }))}
                        >
                          <span className="wm-tab-icon">🖼</span> Image Logo (PNG)
                        </button>
                      </div>

                      {/* Text mode */}
                      {(aiConfig.watermark2Type || 'text') === 'text' && (
                        <div className="wm-section">
                          <label className="wm-label">Text Content (Enter for new line)</label>
                          <textarea
                            className="wm-input wm-textarea"
                            rows={2}
                            value={aiConfig.watermark2Text || ''}
                            onChange={e => setAIConfig(prev => ({ ...prev, watermark2Text: e.target.value }))}
                            placeholder="e.g. Architectural Design Studio&#10;Baghdad, Iraq"
                          />
                        </div>
                      )}

                      {/* Image mode */}
                      {aiConfig.watermark2Type === 'image' && (
                        <div className="wm-section">
                          <label className="wm-label">PNG Logo / Secondary Signature</label>
                          <input
                            type="file"
                            ref={watermark2FileInputRef}
                            accept="image/png,image/svg+xml,image/*"
                            onChange={(ev) => {
                              const f = ev.target.files?.[0];
                              if (!f) return;
                              const reader = new FileReader();
                              reader.onload = (e) => setAIConfig(prev => ({ ...prev, watermark2Image: e.target?.result as string }));
                              reader.readAsDataURL(f);
                              ev.target.value = '';
                            }}
                            style={{ display: 'none' }}
                          />
                          <div className="wm-image-upload" onClick={() => watermark2FileInputRef.current?.click()}>
                            {aiConfig.watermark2Image ? (
                              <div className="wm-image-preview-wrap">
                                <img src={aiConfig.watermark2Image} className="wm-image-preview" alt="watermark 2" />
                                <button type="button" className="wm-image-remove" onClick={e => { e.stopPropagation(); setAIConfig(prev => ({ ...prev, watermark2Image: '' })); }}>✕</button>
                              </div>
                            ) : (
                              <div className="wm-image-placeholder">
                                <Upload size={18} />
                                <span>Click to upload PNG Logo</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Position 9-Grid */}
                      <div className="wm-section">
                        <label className="wm-label">Position</label>
                        <div className="wm-position-grid">
                          {[
                            { v: 'top-left', label: '↖ Top Left' }, { v: 'top-center', label: '↑ Center' }, { v: 'top-right', label: '↗ Top Right' },
                            { v: 'center', label: '· Center' },
                            { v: 'bottom-left', label: '↙ Bottom Left' }, { v: 'bottom-center', label: '↓ Center' }, { v: 'bottom-right', label: '↘ Bottom Right' },
                          ].map(p => (
                            <button
                              key={p.v}
                              type="button"
                              className={`wm-pos-btn ${(aiConfig.watermark2Position || 'top-left') === p.v ? 'active' : ''}`}
                              onClick={() => setAIConfig(prev => ({ ...prev, watermark2Position: p.v as WatermarkPosition }))}
                            >{p.label}</button>
                          ))}
                        </div>
                      </div>

                      {/* Sliders in a tight row */}
                      <div className="wm-sliders-compact">
                        <div className="wm-slider-item">
                          <div className="wm-slider-header">
                            <span className="wm-label">Opacity</span>
                            <span className="wm-slider-val">{((aiConfig.watermark2Opacity ?? 0.5) * 100).toFixed(0)}%</span>
                          </div>
                          <input type="range" min="0.05" max="1" step="0.05"
                            className="wm-slider"
                            value={aiConfig.watermark2Opacity ?? 0.5}
                            onChange={e => setAIConfig(prev => ({ ...prev, watermark2Opacity: Number.parseFloat(e.target.value) }))}
                          />
                        </div>

                        {(aiConfig.watermark2Type || 'text') === 'text' ? (
                          <div className="wm-slider-item">
                            <div className="wm-slider-header">
                              <span className="wm-label">Font Size</span>
                              <span className="wm-slider-val">{aiConfig.watermark2FontSize || 24}px</span>
                            </div>
                            <input type="range" min="12" max="96" step="2"
                              className="wm-slider"
                              value={aiConfig.watermark2FontSize || 24}
                              onChange={e => setAIConfig(prev => ({ ...prev, watermark2FontSize: Number.parseInt(e.target.value) }))}
                            />
                          </div>
                        ) : (
                          <div className="wm-slider-item">
                            <div className="wm-slider-header">
                              <span className="wm-label">Image Size</span>
                              <span className="wm-slider-val">{aiConfig.watermark2ImageSize || 20}%</span>
                            </div>
                            <input type="range" min="5" max="80" step="5"
                              className="wm-slider"
                              value={aiConfig.watermark2ImageSize || 20}
                              onChange={e => setAIConfig(prev => ({ ...prev, watermark2ImageSize: Number.parseInt(e.target.value) }))}
                            />
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="wm-disabled-placeholder">
                      <p>Watermark 2 is currently disabled. Check the box above to activate it.</p>
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* RIGHT COLUMN: Live Output Mockup & Typography Inspector */}
            <div className="wm-preview-col">
              
              {/* Live Canvas Mockup */}
              <div className="wm-preview-card">
                <div className="wm-preview-header">
                  <span className="wm-preview-title">Live Canvas Output</span>
                  <span className="wm-preview-badge">16:9 Composite</span>
                </div>
                <div className="wm-canvas-mockup">
                  <div className="wm-mockup-bg">
                    <div className="wm-mockup-watermarks">
                      {/* Watermark 1 Layer */}
                      {aiConfig.enableWatermark && (
                        <div className={`wm-mockup-layer pos-${aiConfig.watermarkPosition || 'bottom-right'}`}
                          style={{ opacity: aiConfig.watermarkOpacity ?? 0.5 }}
                        >
                          {(aiConfig.watermarkType || 'text') === 'image' && aiConfig.watermarkImage ? (
                            <img src={aiConfig.watermarkImage} alt="wm1" style={{ width: `${Math.max(30, (aiConfig.watermarkImageSize || 20) * 1.5)}px`, maxWidth: '120px' }} />
                          ) : (
                            <span style={{ fontSize: `${Math.max(11, Math.min(26, (aiConfig.watermarkFontSize || 24) * 0.55))}px`, fontWeight: 700, whiteSpace: 'pre-line', lineHeight: 1.25 }}>
                              {aiConfig.watermarkText || 'Anarchy AI'}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Watermark 2 Layer */}
                      {aiConfig.enableWatermark2 && (
                        <div className={`wm-mockup-layer pos-${aiConfig.watermark2Position || 'top-left'}`}
                          style={{ opacity: aiConfig.watermark2Opacity ?? 0.5 }}
                        >
                          {aiConfig.watermark2Type === 'image' && aiConfig.watermark2Image ? (
                            <img src={aiConfig.watermark2Image} alt="wm2" style={{ width: `${Math.max(30, (aiConfig.watermark2ImageSize || 20) * 1.5)}px`, maxWidth: '120px' }} />
                          ) : (
                            <span style={{ fontSize: `${Math.max(11, Math.min(26, (aiConfig.watermark2FontSize || 24) * 0.55))}px`, fontWeight: 700, whiteSpace: 'pre-line', lineHeight: 1.25 }}>
                              {aiConfig.watermark2Text || 'Secondary Watermark'}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Full Detail Typography / Logo Inspector Card */}
              <div className="wm-inspector-card">
                <div className="wm-inspector-header">
                  <span className="wm-inspector-title">Active Element Detail</span>
                  <span className="wm-inspector-badge">
                    {activeWmSlot === 'wm1'
                      ? ((aiConfig.watermarkType || 'text') === 'text' ? `${aiConfig.watermarkFontSize || 24}px` : `${aiConfig.watermarkImageSize || 20}%`)
                      : ((aiConfig.watermark2Type || 'text') === 'text' ? `${aiConfig.watermark2FontSize || 24}px` : `${aiConfig.watermark2ImageSize || 20}%`)}
                  </span>
                </div>
                <div className="wm-inspector-body">
                  {activeWmSlot === 'wm1' ? (
                    (aiConfig.watermarkType || 'text') === 'text' ? (
                      <span style={{
                        fontSize: `${aiConfig.watermarkFontSize || 24}px`,
                        opacity: aiConfig.watermarkOpacity ?? 0.5,
                        fontWeight: 700,
                        letterSpacing: '0.02em',
                        whiteSpace: 'pre-line',
                        lineHeight: 1.3,
                        textShadow: '0 2px 8px rgba(0,0,0,0.8), 0 1px 2px rgba(0,0,0,0.9)'
                      }}>
                        {aiConfig.watermarkText || 'Anarchy AI'}
                      </span>
                    ) : (
                      aiConfig.watermarkImage ? (
                        <img src={aiConfig.watermarkImage} alt="logo 1"
                          style={{ width: `${aiConfig.watermarkImageSize || 20}%`, maxWidth: 160, opacity: aiConfig.watermarkOpacity ?? 0.5, filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.7))' }} />
                      ) : (
                        <span className="wm-inspector-empty">No logo uploaded yet</span>
                      )
                    )
                  ) : (
                    (aiConfig.watermark2Type || 'text') === 'text' ? (
                      <span style={{
                        fontSize: `${aiConfig.watermark2FontSize || 24}px`,
                        opacity: aiConfig.watermark2Opacity ?? 0.5,
                        fontWeight: 700,
                        letterSpacing: '0.02em',
                        whiteSpace: 'pre-line',
                        lineHeight: 1.3,
                        textShadow: '0 2px 8px rgba(0,0,0,0.8), 0 1px 2px rgba(0,0,0,0.9)'
                      }}>
                        {aiConfig.watermark2Text || 'Secondary Watermark'}
                      </span>
                    ) : (
                      aiConfig.watermark2Image ? (
                        <img src={aiConfig.watermark2Image} alt="logo 2"
                          style={{ width: `${aiConfig.watermark2ImageSize || 20}%`, maxWidth: 160, opacity: aiConfig.watermark2Opacity ?? 0.5, filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.7))' }} />
                      ) : (
                        <span className="wm-inspector-empty">No logo uploaded yet</span>
                      )
                    )
                  )}
                </div>
              </div>

            </div>

          </div>

        </div>
      )}
    </div>
  );
};
