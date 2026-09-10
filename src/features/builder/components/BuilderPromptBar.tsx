import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Camera, Sparkles, Building2, HardHat, Blend,
  Sofa, Factory, Leaf, Wind, Gem, Flame, Crown,
  Moon, Lightbulb, MoonStar, Sun, Sunset, SunDim,
  Cloud, Stars, CloudSun, SunMedium,
  CloudRain, Snowflake, CloudFog, Flower2,
  Sprout, TreePine, Waves,
  Users, Footprints, Home, Car, Zap, Bird, Cat,
  Plane, ArrowUpFromLine, DoorOpen, MoveRight, ArrowDownFromLine, Focus,
  Search, PersonStanding, Layers,
  Clapperboard, BookImage, CircleDashed, PenLine, Paintbrush,
  SwatchBook, PanelTop, Ruler, Scissors, Box, Map,
  Aperture, BookOpen, Coins, GitBranch,
  type LucideIcon
} from 'lucide-react';
import { PRESET_PROMPTS, VIDEO_PRESET_PROMPTS, GENERATE_PRESET_PROMPTS } from '../presetPrompts';
import { FillPromptModal } from './FillPromptModal';
import { AutoPromptButton } from './AutoPromptButton';
import { getUnifiedCost } from '../../../services/credit/creditService';
import { useAIConfigStore } from '../../../stores/aiConfigStore';

const PRESET_ICON_MAP: Record<string, LucideIcon> = {
  Camera, Sparkles, Building2, HardHat, Blend,
  Sofa, Factory, Leaf, Wind, Gem, Flame, Crown,
  Moon, Lightbulb, MoonStar, Sun, Sunset, SunDim,
  Cloud, Stars, CloudSun, SunMedium,
  CloudRain, Snowflake, CloudFog, Flower2,
  Sprout, TreePine, Waves,
  Users, Footprints, Home, Car, Zap, Bird, Cat,
  Plane, ArrowUpFromLine, DoorOpen, MoveRight, ArrowDownFromLine, Focus,
  Search, PersonStanding, Layers,
  Clapperboard, BookImage, CircleDashed, PenLine, Paintbrush,
  SwatchBook, PanelTop, Ruler, Scissors, Box, Map,
  Aperture, GitBranch
};

interface BuilderPromptBarProps {
  prompt: string;
  setPrompt: (prompt: string) => void;
  canGenerate: boolean;
  isUpscaler: boolean;
  hasUpscaleFactor: boolean;
  hasSourceWithImage: boolean;
  canvasHasAnyImage: boolean;
  liveModel: string;
  liveResolution: string;
  liveQuality: string;
  livePruna: number | undefined;
  upscaleFactor?: number;
  userCredits: number | null;
  isTrial?: boolean;
  activeRole?: 'inpaint' | 'upscale' | 'render';
  maskDataUrl?: string | null;
  onGenerate: () => void;
  onPromptContextMenu: (event: React.MouseEvent) => void;
}

export const BuilderPromptBar: React.FC<BuilderPromptBarProps> = ({
  prompt,
  setPrompt,
  canGenerate,
  isUpscaler,
  hasUpscaleFactor,
  hasSourceWithImage,
  liveModel,
  liveResolution: _liveResolution,
  liveQuality: _liveQuality,
  livePruna: _livePruna,
  upscaleFactor: _upscaleFactor,
  userCredits,
  isTrial = true,
  activeRole = 'render',
  maskDataUrl,
  onGenerate,
  onPromptContextMenu,
}) => {
  const [showPresets, setShowPresets] = useState(false);
  const [showFillPromptModal, setShowFillPromptModal] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const aiConfig = useAIConfigStore((s) => s.config);

  // ── Recent Prompts History ──────────────────────────────────────────────────
  const [_recentPrompts, setRecentPrompts] = useState<{ text: string; label: string; icon?: string }[]>([]);

  useEffect(() => {
    (window as any).__anarchyCurrentPrompt = prompt;
    useAIConfigStore.getState().setWorkspacePrompt(prompt);
  }, [prompt]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('anarchy_recent_prompts');
      if (stored) {
        setRecentPrompts(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load recent prompts:', e);
    }
  }, []);

  const addRecentPrompt = (text: string, label: string, icon?: string) => {
    if (!text.trim()) return;
    setRecentPrompts(prev => {
      const filtered = prev.filter(p => p.text.trim() !== text.trim());
      const updated = [{ text, label, icon }, ...filtered].slice(0, 5);
      try {
        localStorage.setItem('anarchy_recent_prompts', JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save recent prompts:', e);
      }
      return updated;
    });
  };

  const handleGenerateClick = () => {
    try {
      if (prompt.trim()) {
        const match = [...(PRESET_PROMPTS || []), ...(VIDEO_PRESET_PROMPTS || []), ...(GENERATE_PRESET_PROMPTS || [])]
          .flatMap(g => g?.prompts || [])
          .find(p => p?.text?.trim() === prompt.trim() || p?.label?.trim() === prompt.trim());
        
        if (match) {
          addRecentPrompt(match.text, match.label, match.icon);
        } else {
          const shortLabel = prompt.trim().slice(0, 30) + (prompt.trim().length > 30 ? '...' : '');
          addRecentPrompt(prompt.trim(), shortLabel, 'PenLine');
        }
      }
    } catch (e) {
      console.error('[PromptBar] Non-fatal error processing prompt presets:', e);
    } finally {
      onGenerate();
    }
  };

  const VIDEO_MODEL_IDS = [
    'bytedance/seedance-2.0',
    'kwaivgi/kling-v3-omni-video',
    'xai/grok-imagine-video-1.5',
    'prunaai/p-video',
    'google/veo-3.1-fast',
    'pixverse/pixverse-v6',
    'openai/sora-2-pro',
    'wavespeedai/wan-2.1-i2v-480p',
    'wavespeedai/wan-2.1-i2v-720p',
  ];
  const isVideoModel = VIDEO_MODEL_IDS.some(id => liveModel.startsWith(id) || id.startsWith(liveModel));
  const studioMode = aiConfig.studioMode || 'edit';
  const isGenerateMode = aiConfig.selectedTool === 'image-editor' && studioMode === 'generate';
  const activePrompts = isVideoModel
    ? VIDEO_PRESET_PROMPTS
    : isGenerateMode
      ? GENERATE_PRESET_PROMPTS
      : PRESET_PROMPTS;

  useEffect(() => {
    if (!showPresets) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.prompt-presets-wrapper')) {
        setShowPresets(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showPresets]);

  // Dynamically adjust textarea height based on contents
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(Math.max(textarea.scrollHeight, 40), 100);
      textarea.style.height = `${newHeight}px`;
    }
  }, [prompt]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerateClick();
    }
  };

  const selectedNode = useAIConfigStore((s) => s.selectedNode);
  const effectiveConfig = useMemo(() => {
    if (liveModel === 'topazlabs/image-upscale' && selectedNode?.dimensions?.width && selectedNode?.dimensions?.height) {
      return {
        ...aiConfig,
        width: selectedNode.dimensions.width,
        height: selectedNode.dimensions.height,
      };
    }
    return aiConfig;
  }, [aiConfig, liveModel, selectedNode?.dimensions]);

  const cost = getUnifiedCost(effectiveConfig, isTrial, liveModel);

  const isUpscaleMode = isUpscaler || activeRole === 'upscale' || aiConfig.selectedTool === 'image-upscaler';
  const isInpaintMode = activeRole === 'inpaint' || Boolean(maskDataUrl);

  const getPlaceholderText = () => {
    if (isInpaintMode) {
      return "🎨 Mask region active — Describe what to generate inside painted area...";
    }
    if (isUpscaleMode) {
      return "🔍 Selective Enlarge active — Optional style & prompt instructions...";
    }
    return "Describe what you want to create...";
  };

  return (
    <>
      <div className={`builder-prompt-container ${isInpaintMode ? 'inpaint-active' : ''} ${isUpscaleMode ? 'upscale-active' : ''}`}>
        <textarea 
          ref={textareaRef}
          className="builder-prompt-input"
          placeholder={getPlaceholderText()}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!canGenerate}
          onContextMenu={onPromptContextMenu}
          rows={1}
        />
        <AutoPromptButton
          prompt={prompt}
          onApplyPrompt={(newPrompt) => setPrompt(newPrompt)}
          mode={isInpaintMode ? 'inpaint' : (isUpscaleMode ? 'upscale' : 'generate')}
        />
        {!isUpscaleMode && (
          <div className="prompt-presets-wrapper">
            <button
              type="button"
              className="prompt-presets-btn"
              onClick={() => setShowPresets(prev => !prev)}
              title="Preset Prompts"
            >
              <BookOpen size={16} />
            </button>
            {showPresets && (
              <div className="prompt-presets-popup">
                <div className="presets-header">
                  <span>Preset Prompts</span>
                </div>

                {/* Interactive Fill Prompt Generator Button */}
                <button
                  type="button"
                  className="presets-fill-prompt-btn"
                  onClick={() => {
                    setShowPresets(false);
                    setShowFillPromptModal(true);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    margin: '6px 0 10px 0',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, rgba(225, 29, 72, 0.25) 0%, rgba(190, 18, 60, 0.4) 100%)',
                    border: '1px solid rgba(225, 29, 72, 0.5)',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(225, 29, 72, 0.2)',
                    transition: 'all 0.15s ease-in-out',
                  }}
                >
                  <Sparkles size={16} color="#e11d48" />
                  <span>✨ Interactive Fill Prompt Generator</span>
                </button>

                {activePrompts.map((group) => (
                  <div key={group.category} className="presets-group">
                    <div className="presets-category">
                      {PRESET_ICON_MAP[group.icon] && (() => {
                        const Icon = PRESET_ICON_MAP[group.icon];
                        return <Icon size={12} className="category-icon" style={{ marginRight: '6px', verticalAlign: 'middle', display: 'inline-block' }} />;
                      })()}
                      <span style={{ verticalAlign: 'middle' }}>{group.category}</span>
                    </div>
                    {group.prompts.map((p) => {
                      const hasRefImage = hasSourceWithImage;
                      const needsRefImage = p.requiresReferenceImage && !hasRefImage;

                      return (
                        <button
                          type="button"
                          key={p.label}
                          className={`preset-item ${p.tier === 'advanced' ? 'advanced-tier' : ''}`}
                          onClick={() => {
                            setPrompt(p.text);
                            addRecentPrompt(p.text, p.label, p.icon);
                            setShowPresets(false);
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                            <span className="preset-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {PRESET_ICON_MAP[p.icon] && (() => { 
                                const Icon = PRESET_ICON_MAP[p.icon]; 
                                return <Icon size={16} className="preset-icon" style={{ marginRight: '6px' }} />; 
                              })()}
                              {p.label}
                            </span>
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                              {p.tier === 'advanced' && (
                                <span style={{
                                  fontSize: '8px',
                                  padding: '1px 4px',
                                  borderRadius: '4px',
                                  background: 'rgba(225, 29, 72, 0.15)',
                                  border: '1px solid rgba(225, 29, 72, 0.3)',
                                  color: '#e11d48',
                                  fontWeight: 600,
                                  textTransform: 'uppercase'
                                }}>
                                  Advanced
                                </span>
                              )}
                              {p.requiresReferenceImage && (
                                <span style={{
                                  fontSize: '8px',
                                  padding: '1px 4px',
                                  borderRadius: '4px',
                                  background: needsRefImage ? 'rgba(239, 68, 68, 0.15)' : 'rgba(251, 191, 36, 0.15)',
                                  border: needsRefImage ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(251, 191, 36, 0.3)',
                                  color: needsRefImage ? '#ef4444' : '#fbbf24',
                                  fontWeight: 600,
                                  textTransform: 'uppercase'
                                }} title={needsRefImage ? "Warning: Needs a reference image but none is uploaded!" : "Requires reference image"}>
                                  Ref Image
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="preset-preview">
                            {p.text.length > 70 ? `${p.text.slice(0, 70)}...` : p.text}
                          </span>
                          {p.note && (
                            <span style={{
                              fontSize: '9px',
                              color: 'rgba(255, 255, 255, 0.35)',
                              fontStyle: 'italic',
                              marginTop: '2px',
                              paddingLeft: '22px',
                              textAlign: 'left',
                              display: 'block'
                            }}>
                              * {p.note}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <button 
          type="button"
          className="generate-btn" 
          onClick={handleGenerateClick}
          disabled={!canGenerate || (!prompt.trim() && !(isUpscaler && hasUpscaleFactor && hasSourceWithImage))}
        >
          <Sparkles size={16} />
          <span>Generate</span>
        </button>
      </div>

      <div className="prompt-bottom-badges-container">
        <span className="generate-cost-badge" title="Credits required per generation">
          <Coins size={10} />
          Cost: {cost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
        </span>
        {userCredits !== null && (
          <span className="user-balance-badge" title="Your available credits">
            <Coins size={10} className="balance-icon" />
            Balance: {userCredits.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
          </span>
        )}
      </div>

      {/* Interactive VizMaker-style Fill Prompt Generator Modal */}
      <FillPromptModal
        isOpen={showFillPromptModal}
        onClose={() => setShowFillPromptModal(false)}
        onApplyPrompt={(p) => setPrompt(p)}
        isArabic={false}
      />
    </>
  );
};
