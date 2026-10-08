import React, { useState } from 'react';
import { Palette, Copy, Check, Sparkles, Layers, Box, Compass } from 'lucide-react';
import type { ArchitecturalMaterialPalette } from '../../../services/agent/ArchitecturalMaterialExtractor';
import { useAIConfigStore } from '../../../stores/aiConfigStore';
import { canvasBridge } from '../../../services/agent/CanvasBridgeService';
import './ArchitecturalMaterialPaletteCard.css';

interface ArchitecturalMaterialPaletteCardProps {
  palette: ArchitecturalMaterialPalette;
  onApplyPrompt?: (materialPrompt: string) => void;
  onForkBranches?: () => void;
}

export const ArchitecturalMaterialPaletteCard: React.FC<ArchitecturalMaterialPaletteCardProps> = ({
  palette,
  onApplyPrompt,
  onForkBranches,
}) => {
  const [copiedHex, setCopiedHex] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const [createdNode, setCreatedNode] = useState(false);

  const handleCopyHex = (hex: string) => {
    navigator.clipboard.writeText(hex);
    setCopiedHex(hex);
    setTimeout(() => setCopiedHex(null), 1800);
  };

  const handleApplyToPrompt = () => {
    const materialsStr = palette.materials.map(m => `${m.name} (${m.finish})`).join(', ');
    const colorsStr = palette.colors.slice(0, 3).map(c => `${c.name} ${c.hex}`).join(', ');
    const injection = `, specified materiality: ${materialsStr}, architectural palette: ${colorsStr}`;

    const currentPrompt = useAIConfigStore.getState().workspacePrompt || '';
    const newPrompt = currentPrompt ? `${currentPrompt}${injection}` : injection.slice(2);
    useAIConfigStore.getState().setWorkspacePrompt(newPrompt);

    if (onApplyPrompt) onApplyPrompt(newPrompt);
    setApplied(true);
    setTimeout(() => setApplied(false), 2000);
  };

  const handleCreateCanvasSwatchNode = async () => {
    const selected = canvasBridge.getActiveNode();
    const promptText = `Architectural Material Specification Moodboard: ${palette.paletteName}. Materials: ${palette.materials.map(m => m.name).join(', ')}. Palette: ${palette.colors.map(c => `${c.name} (${c.hex})`).join(', ')}`;
    
    if (selected?.id) {
      await canvasBridge.forkNode(selected.id, undefined, `${palette.paletteName} Swatch`, promptText);
      setCreatedNode(true);
      setTimeout(() => setCreatedNode(false), 2500);
    }
  };

  return (
    <div className="arch-palette-card">
      <div className="arch-palette-header">
        <div className="arch-palette-title-group">
          <Palette size={16} className="arch-palette-icon" />
          <span className="arch-palette-title">{palette.paletteName}</span>
          <span className="arch-palette-badge">AEC Materiality</span>
        </div>
        <div className="arch-palette-temp">
          <Compass size={12} />
          <span>{palette.lightingProfile.ambientColorTemp}K Ambient</span>
        </div>
      </div>

      <p className="arch-palette-summary">{palette.summary}</p>

      {/* Colors Swatches Bar */}
      <div className="arch-swatches-grid">
        {palette.colors.map((swatch, idx) => (
          <div
            key={idx}
            className="arch-swatch-item"
            onClick={() => handleCopyHex(swatch.hex)}
            title={`Click to copy ${swatch.hex}`}
          >
            <div
              className="arch-swatch-circle"
              style={{ backgroundColor: swatch.hex }}
            >
              {copiedHex === swatch.hex && <Check size={10} className="arch-swatch-check" />}
            </div>
            <div className="arch-swatch-meta">
              <span className="arch-swatch-name">{swatch.name}</span>
              <span className="arch-swatch-hex">{swatch.hex}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Tectonic Materials List */}
      <div className="arch-materials-list">
        {palette.materials.map((mat, idx) => (
          <div key={idx} className="arch-material-row">
            <Box size={13} className="arch-mat-box-icon" />
            <div className="arch-material-info">
              <span className="arch-material-name">{mat.name}</span>
              <span className="arch-material-finish">{mat.finish} &bull; <em className="arch-material-loc">{mat.location}</em></span>
            </div>
            <span className={`arch-material-reflect ${mat.reflectivity}`}>
              {mat.reflectivity}
            </span>
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="arch-palette-actions">
        <button
          type="button"
          className="arch-palette-btn primary"
          onClick={handleApplyToPrompt}
        >
          {applied ? <Check size={13} /> : <Sparkles size={13} />}
          <span>{applied ? 'Applied to Prompt!' : 'Apply Materials to Prompt'}</span>
        </button>

        <button
          type="button"
          className="arch-palette-btn secondary"
          onClick={handleCreateCanvasSwatchNode}
        >
          {createdNode ? <Check size={13} /> : <Layers size={13} />}
          <span>{createdNode ? 'Created on Canvas' : 'Fork Swatch to Canvas'}</span>
        </button>

        {onForkBranches && (
          <button
            type="button"
            className="arch-palette-btn secondary"
            onClick={onForkBranches}
            title="Generate 4 material variations simultaneously"
          >
            <Box size={13} />
            <span>Generate 4 Variations</span>
          </button>
        )}
      </div>
    </div>
  );
};
