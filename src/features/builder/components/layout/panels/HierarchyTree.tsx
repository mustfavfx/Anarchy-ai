import React from 'react';
import { ChevronDown, ChevronRight, Edit3, X } from 'lucide-react';
import { type TreeNode, REGION_COLORS } from '../types';

export interface HierarchyTreeProps {
  nodes: TreeNode[];
  selectedRegionIdx: number | null;
  hoveredRegionIdx: number | null;
  activeEditingIdx: number | null;
  expandedNodes: Record<number, boolean>;
  cropThumbnails: Record<number, string>;
  regionPrompts: Record<number, string>;
  cardRefs: React.MutableRefObject<Record<number, HTMLDivElement | null>>;
  onSelectRegion: (idx: number) => void;
  setHoveredRegionIdx: (idx: number | null) => void;
  setActiveEditingIdx: (idx: number | null) => void;
  toggleNodeExpand: (idx: number, e: React.MouseEvent) => void;
  updateRegionPrompt: (idx: number, prompt: string) => void;
  depth?: number;
}

export const HierarchyTree: React.FC<HierarchyTreeProps> = ({
  nodes,
  selectedRegionIdx,
  hoveredRegionIdx,
  activeEditingIdx,
  expandedNodes,
  cropThumbnails,
  regionPrompts,
  cardRefs,
  onSelectRegion,
  setHoveredRegionIdx,
  setActiveEditingIdx,
  toggleNodeExpand,
  updateRegionPrompt,
  depth = 0,
}) => {
  return (
    <>
      {nodes.map(node => {
        const { originalIdx, reg, children } = node;
        const color = REGION_COLORS[originalIdx % REGION_COLORS.length];
        const isSelected = selectedRegionIdx === originalIdx;
        const isHovered = hoveredRegionIdx === originalIdx;
        const isEditing = activeEditingIdx === originalIdx;
        const hasChildren = children.length > 0;
        const isNodeExpanded = expandedNodes[originalIdx] ?? true;

        return (
          <div key={originalIdx} className="reve-tree-node-wrapper">
            <div
              ref={(el) => { cardRefs.current[originalIdx] = el; }}
              className={`reve-item-row depth-${depth} ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''}`}
              style={{ paddingLeft: `${8 + depth * 20}px` }}
              onClick={() => onSelectRegion(originalIdx)}
              onMouseEnter={() => setHoveredRegionIdx(originalIdx)}
              onMouseLeave={() => setHoveredRegionIdx(null)}
            >
              <div className="reve-item-main">
                {hasChildren ? (
                  <button
                    type="button"
                    className="reve-chevron-btn"
                    onClick={(e) => toggleNodeExpand(originalIdx, e)}
                  >
                    {isNodeExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                ) : (
                  <div className="reve-chevron-spacer" />
                )}

                {cropThumbnails[originalIdx] ? (
                  <img src={cropThumbnails[originalIdx]} alt={reg.label} className="reve-item-thumb" />
                ) : (
                  <div className="reve-item-thumb-placeholder" style={{ backgroundColor: `${color}30` }} />
                )}

                <span className="reve-item-label">{reg.label}</span>

                <button
                  type="button"
                  className={`reve-item-edit-btn ${isEditing ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveEditingIdx(isEditing ? null : originalIdx);
                  }}
                  title="Edit prompt"
                >
                  {hasChildren && !isEditing ? (
                    isNodeExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                  ) : (
                    <Edit3 size={12} />
                  )}
                </button>
              </div>

              {isEditing && (
                <div className="reve-edit-prompt-box" onClick={(e) => e.stopPropagation()}>
                  <div className="box-title-row">
                    <span className="box-title">Edit Prompt for {reg.label}</span>
                    <button type="button" className="close-box-btn" onClick={() => setActiveEditingIdx(null)}>
                      <X size={12} />
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    className="reve-prompt-textarea"
                    placeholder={`Specify changes for ${reg.label}...`}
                    value={regionPrompts[originalIdx] ?? ''}
                    onChange={(e) => updateRegionPrompt(originalIdx, e.target.value)}
                  />
                </div>
              )}
            </div>

            {hasChildren && isNodeExpanded && (
              <div className="reve-tree-children">
                <HierarchyTree
                  nodes={children}
                  selectedRegionIdx={selectedRegionIdx}
                  hoveredRegionIdx={hoveredRegionIdx}
                  activeEditingIdx={activeEditingIdx}
                  expandedNodes={expandedNodes}
                  cropThumbnails={cropThumbnails}
                  regionPrompts={regionPrompts}
                  cardRefs={cardRefs}
                  onSelectRegion={onSelectRegion}
                  setHoveredRegionIdx={setHoveredRegionIdx}
                  setActiveEditingIdx={setActiveEditingIdx}
                  toggleNodeExpand={toggleNodeExpand}
                  updateRegionPrompt={updateRegionPrompt}
                  depth={depth + 1}
                />
              </div>
            )}
          </div>
        );
      })}
    </>
  );
};
