import React, { useState } from 'react';
import { Layers, Plus, Trash2, Image, Sparkles, X } from 'lucide-react';
import './MultiRegionManager.css';

export interface InpaintRegion {
  id: string;
  name: string;
  prompt: string;
  colorHex?: string;
  materialRef?: string | null;
  bounds: { x: number; y: number; w: number; h: number };
  active: boolean;
}

interface MultiRegionManagerProps {
  regions: InpaintRegion[];
  onAddRegion: () => void;
  onUpdateRegion: (id: string, updates: Partial<InpaintRegion>) => void;
  onRemoveRegion: (id: string) => void;
  onExecuteAll: () => void;
  isGenerating?: boolean;
}

export const MultiRegionManager: React.FC<MultiRegionManagerProps> = ({
  regions,
  onAddRegion,
  onUpdateRegion,
  onRemoveRegion,
  onExecuteAll,
  isGenerating = false,
}) => {
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(
    regions[0]?.id ?? null
  );

  return (
    <div className="multi-region-container">
      <div className="multi-region-header">
        <div className="multi-region-title">
          <Layers size={14} className="icon-accent" />
          <span>Multi-Region Inpaint Manager</span>
          <span className="region-count-badge">{regions.length}</span>
        </div>
        <button
          type="button"
          className="multi-region-add-btn"
          onClick={onAddRegion}
          title="Add new masked region"
        >
          <Plus size={13} /> Add Region
        </button>
      </div>

      <div className="multi-region-list">
        {regions.length === 0 ? (
          <div className="multi-region-empty">
            <span>No active regions. Draw a box or lasso on the canvas to add region.</span>
          </div>
        ) : (
          regions.map((reg, idx) => (
            <div
              key={reg.id}
              className={`multi-region-card ${selectedRegionId === reg.id ? 'active' : ''}`}
              onClick={() => setSelectedRegionId(reg.id)}
            >
              <div className="region-card-top">
                <span className="region-badge">R{idx + 1}</span>
                <input
                  type="text"
                  className="region-name-input"
                  value={reg.name}
                  onChange={(e) => onUpdateRegion(reg.id, { name: e.target.value })}
                  placeholder={`Region ${idx + 1}`}
                />
                <button
                  type="button"
                  className="region-del-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveRegion(reg.id);
                  }}
                  title="Remove region"
                >
                  <Trash2 size={12} />
                </button>
              </div>

              <div className="region-card-body">
                <textarea
                  className="region-prompt-input"
                  value={reg.prompt}
                  onChange={(e) => onUpdateRegion(reg.id, { prompt: e.target.value })}
                  placeholder="Region Prompt (e.g. Add leather sofa, change material to marble)..."
                  rows={2}
                />

                <div className="region-ref-row">
                  <label className="region-ref-upload">
                    <Image size={12} />
                    <span>{reg.materialRef ? 'Ref Attached' : 'Attach Ref Photo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = () => onUpdateRegion(reg.id, { materialRef: reader.result as string });
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>

                  {reg.materialRef && (
                    <div className="region-ref-preview">
                      <img src={reg.materialRef} alt="Ref" />
                      <button
                        type="button"
                        className="remove-ref-btn"
                        onClick={() => onUpdateRegion(reg.id, { materialRef: null })}
                      >
                        <X size={10} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {regions.length > 0 && (
        <button
          type="button"
          className="multi-region-exec-btn"
          onClick={onExecuteAll}
          disabled={isGenerating}
        >
          <Sparkles size={14} />
          <span>{isGenerating ? 'Generating All Regions...' : 'Execute Multi-Region Batch'}</span>
        </button>
      )}
    </div>
  );
};
