import React, { useState, useEffect } from 'react';
import { 
  Camera, Sparkles, Building, HardHat,
  Moon, Lightbulb, Sun, Sunset, SunDim, Palette,
  CloudRain, Leaf, Snowflake, CloudFog, SunMedium,
  Search, Focus, PersonStanding, Cat,
  Users, Footprints, Car, Zap, Bird,
  Flower2, Sprout, TreePine,
  Plane, MoveRight, ArrowDownFromLine, RotateCcw,
  SwatchBook, PanelTop, Ruler, Scissors, Box, PenLine, Hexagon,
  Clapperboard, Gem, BookImage, CircleDashed,
  BookOpen, FolderDown, Coins,
  type LucideIcon
} from 'lucide-react';
import { PRESET_PROMPTS } from '../presetPrompts';
import { getModelCost } from '../../../services/credit/creditService';

const PRESET_ICON_MAP: Record<string, LucideIcon> = {
  Camera, Sparkles, Building, HardHat,
  Moon, Lightbulb, Sun, Sunset, SunDim, Palette,
  CloudRain, Leaf, Snowflake, CloudFog, SunMedium,
  Search, Focus, PersonStanding, Cat,
  Users, Footprints, Car, Zap, Bird,
  Flower2, Sprout, TreePine,
  Plane, MoveRight, ArrowDownFromLine, RotateCcw,
  SwatchBook, PanelTop, Ruler, Scissors, Box, PenLine, Hexagon,
  Clapperboard, Gem, BookImage, CircleDashed,
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
  onGenerate: () => void;
  onExportAll: () => void;
  onPromptContextMenu: (event: React.MouseEvent) => void;
}

export const BuilderPromptBar: React.FC<BuilderPromptBarProps> = ({
  prompt,
  setPrompt,
  canGenerate,
  isUpscaler,
  hasUpscaleFactor,
  hasSourceWithImage,
  canvasHasAnyImage,
  liveModel,
  liveResolution,
  liveQuality,
  livePruna,
  onGenerate,
  onExportAll,
  onPromptContextMenu,
}) => {
  const [showPresets, setShowPresets] = useState(false);

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

  return (
    <>
      <div className="builder-prompt-container">
        <input 
          type="text" 
          className="builder-prompt-input"
          placeholder="Describe what you want to create..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              onGenerate();
            }
          }}
          disabled={!canGenerate}
          onContextMenu={onPromptContextMenu}
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
                  <div className="presets-category">{group.category}</div>
                  {group.prompts.map((p) => (
                    <button
                      type="button"
                      key={p.label}
                      className="preset-item"
                      onClick={() => {
                        setPrompt(p.text);
                        setShowPresets(false);
                      }}
                    >
                      <span className="preset-label">
                        {PRESET_ICON_MAP[p.icon] && (() => { 
                          const Icon = PRESET_ICON_MAP[p.icon]; 
                          return <Icon size={16} className="preset-icon" />; 
                        })()}
                        {p.label}
                      </span>
                      <span className="preset-preview">{p.text.length > 70 ? `${p.text.slice(0, 70)}...` : p.text}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          className="export-all-btn"
          onClick={onExportAll}
          disabled={!canvasHasAnyImage}
          title="Export All Images"
        >
          <FolderDown size={16} />
        </button>
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
      <span className="generate-cost-badge" title="Credits per generation">
        <Coins size={10} />
        {getModelCost(liveModel, { resolution: liveResolution, qualityVariant: liveQuality, prunaTarget: livePruna })}
      </span>
    </>
  );
};
