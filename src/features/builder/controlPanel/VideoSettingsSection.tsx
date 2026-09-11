import React from 'react';
import { PanelSelect, PanelFileSelector } from './panelTypes';
import type { AIControlPanelProps, ToolType } from './panelTypes';

export interface VideoSettingsSectionProps {
  selectedTool?: ToolType;
  selectedModel: string;
  params: AIControlPanelProps['params'];
  updateParam: (key: keyof AIControlPanelProps['params'], value: any) => void;
}

export const VideoSettingsSection: React.FC<VideoSettingsSectionProps> = ({
  selectedTool,
  selectedModel,
  params,
  updateParam,
}) => {
  if (selectedTool && selectedTool !== 'video-creator') return null;

  return (
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
  );
};
