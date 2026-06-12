import React, { useState, useEffect, useRef } from 'react';
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
  Aperture, BookOpen, Coins,
  type LucideIcon
} from 'lucide-react';
import { PRESET_PROMPTS } from '../presetPrompts';
import { getModelCost } from '../../../services/credit/creditService';

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
  Aperture
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
  userCredits: number | null;
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
  liveResolution,
  liveQuality,
  livePruna,
  userCredits,
  onGenerate,
  onPromptContextMenu,
}) => {
  const [showPresets, setShowPresets] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
      onGenerate();
    }
  };

  const cost = getModelCost(liveModel, {
    resolution: liveResolution,
    qualityVariant: liveQuality,
    prunaTarget: livePruna,
  });

  return (
    <>
      <div className="builder-prompt-container">
        <textarea 
          ref={textareaRef}
          className="builder-prompt-input"
          placeholder="Describe what you want to create..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!canGenerate}
          onContextMenu={onPromptContextMenu}
          rows={1}
        />
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
              <div className="presets-header">Preset Prompts</div>
              {PRESET_PROMPTS.map((group) => (
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
                          setShowPresets(false);
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                          <span className="preset-label">
                            {PRESET_ICON_MAP[p.icon] && (() => { 
                              const Icon = PRESET_ICON_MAP[p.icon]; 
                              return <Icon size={16} className="preset-icon" />; 
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
                        <span className="preset-preview">{p.text.length > 70 ? `${p.text.slice(0, 70)}...` : p.text}</span>
                        {p.note && (
                          <span style={{
                            fontSize: '9px',
                            color: 'rgba(255, 255, 255, 0.35)',
                            fontStyle: 'italic',
                            marginTop: '2px',
                            paddingLeft: '22px'
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
        <button 
          type="button"
          className="generate-btn" 
          onClick={onGenerate}
          disabled={!canGenerate || (!prompt.trim() && !(isUpscaler && hasUpscaleFactor && hasSourceWithImage))}
        >
          <Sparkles size={16} />
          <span>Generate</span>
        </button>
      </div>

      <div className="prompt-bottom-badges-container">
        <span className="generate-cost-badge" title="Credits required per generation">
          <Coins size={10} />
          Cost: {cost}
        </span>
        {userCredits !== null && (
          <span className="user-balance-badge" title="Your available credits">
            <Coins size={10} className="balance-icon" />
            Balance: {userCredits.toFixed(1)}
          </span>
        )}
      </div>
    </>
  );
};

