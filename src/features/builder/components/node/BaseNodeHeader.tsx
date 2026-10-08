import React from 'react';
import { 
  X, AlertCircle, Download, Loader2, Sparkles, GitBranch
} from 'lucide-react';
import type { ProcessingType, BuilderNodeData } from '../../types';
import { SEMANTIC_CATEGORY_META, formatNodeTitle } from './nodeConstants';
import { canvasBridge } from '../../../../services/agent/CanvasBridgeService';
import { useAIConfigStore } from '../../../../stores/aiConfigStore';

interface BaseNodeHeaderProps {
  id: string;
  nodeData: BuilderNodeData;
  displayImage?: string;
  fullImageRaw?: string;
  targetKey?: string;
  isSource: boolean;
  isAnalyzed: boolean;
  isProcessing: boolean;
  isError: boolean;
  isCancelled: boolean;
  onExportClick: (e: React.MouseEvent) => void;
}

export const BaseNodeHeader: React.FC<BaseNodeHeaderProps> = ({
  id,
  nodeData,
  displayImage,
  fullImageRaw,
  targetKey,
  isSource,
  isAnalyzed,
  isProcessing,
  isError,
  isCancelled,
  onExportClick,
}) => {
  return (
    <div className="node-header">
      <div className="node-identity">
        <div className="node-title-group">
          <span className="node-type-label" title={nodeData.label}>
            {formatNodeTitle(nodeData.label, nodeData.modelUsed, nodeData.processingType as ProcessingType | undefined)}
          </span>
          <div className="node-badges-row">
            {nodeData.semantic && (
              <span 
                className={`node-semantic-badge category-${nodeData.semantic.category}`}
                onClick={(e) => {
                  e.stopPropagation();
                  const visionImageKey = fullImageRaw || targetKey;
                  canvasBridge.classifyCanvasNode(id, true, visionImageKey, nodeData.prompt);
                }}
                title={`AI Scene Perception: ${SEMANTIC_CATEGORY_META[nodeData.semantic.category]?.label || nodeData.semantic.category} (${Math.round((nodeData.semantic.confidence || 0.9) * 100)}%)\nClick to re-inspect with AI Vision Engine\n${nodeData.semantic.description || ''}`}
                style={{ cursor: 'pointer' }}
              >
                {SEMANTIC_CATEGORY_META[nodeData.semantic.category]?.icon || <Sparkles size={10} />}
                <span className="node-semantic-label">{SEMANTIC_CATEGORY_META[nodeData.semantic.category]?.label || nodeData.semantic.category}</span>
              </span>
            )}
            {nodeData.lineage?.parentId && (
              <span
                className="node-branch-badge"
                title={`Design Branch (Gen ${nodeData.lineage.generation || 1}) branched from parent: ${nodeData.lineage.parentId}`}
              >
                <GitBranch size={9} />
                <span>Branch v{nodeData.lineage.generation || 1}</span>
              </span>
            )}
            {isAnalyzed && (
              <span className="node-status-badge analyzed" title="Scene Analyzed — Layout & Objects Extracted">
                <Sparkles size={10} />
                Analyzed
              </span>
            )}
            {isProcessing && (
              <span className="node-status-badge processing">
                <Loader2 size={10} className="spin" />
                Processing...
              </span>
            )}
            {isError && (
              <span className="node-status-badge error">
                <AlertCircle size={10} />
                Error
              </span>
            )}
            {isCancelled && (
              <span className="node-status-badge cancelled">
                <X size={10} />
                Cancelled
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="node-actions">
        {displayImage && (
          <button
            type="button"
            className="node-action-btn fork"
            onClick={(e) => {
              e.stopPropagation();
              useAIConfigStore.getState().forkChildNode(id, fullImageRaw || displayImage, 'Design Branch', nodeData.prompt);
            }}
            title="Fork to connected child branch (Family Tree)"
          >
            <GitBranch size={12} />
          </button>
        )}
        {displayImage && (
          <button
            type="button"
            className="node-action-btn download"
            onClick={onExportClick}
            title="Export Image"
          >
            <Download size={12} />
          </button>
        )}
        {!isSource && nodeData.onDelete && (
          <button type="button" className="node-action-btn delete" onClick={(e) => { e.stopPropagation(); nodeData.onDelete?.(); }} title="Delete">
            <X size={12} />
          </button>
        )}
      </div>
    </div>
  );
};
