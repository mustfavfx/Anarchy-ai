/**
 * GhostNode - Processing/Aggregation Stage
 * 
 * Behavioral reference from legacy:
 * - Accepts multiple incoming connections (aggregation stage)
 * - Left-side input handles (dynamic based on incoming edges)
 * - Right-side output for next stage
 * - Acts as connector between upstream images and generated result
 * - Supports non-linear branching workflows
 */

import React, { memo, useMemo, useCallback } from 'react';
import { Handle, Position, type NodeProps, useReactFlow, useEdges } from '@xyflow/react';
import { 
  ImageIcon, Loader2, AlertCircle, Eraser, RefreshCw
} from 'lucide-react';
import type { ProcessingType, BuilderNodeData } from './types';
import './GhostNode.css';
import './GhostNode.glass.css';

// Processing type configuration (color only, used for border glow)
// All types use the brand red for consistency with the app identity
const PROCESSING_CONFIG: Record<ProcessingType, { color: string; label: string }> = {
  source:    { color: '#e11d48', label: 'Source' },
  render:    { color: '#e11d48', label: 'Render' },
  detail:    { color: '#e11d48', label: 'Detail' },
  upscale:   { color: '#e11d48', label: 'Upscale' },
  people:    { color: '#e11d48', label: 'People' },
  daynight:  { color: '#e11d48', label: 'Day/Night' },
  lighting:  { color: '#e11d48', label: 'Lighting' },
  material:  { color: '#e11d48', label: 'Material' },
  local:     { color: '#e11d48', label: 'Local Edit' },
  variation: { color: '#e11d48', label: 'Variation' }
};

export interface GhostNodeData extends BuilderNodeData {
  type: 'ghost';
  processingType: ProcessingType;
  promptDraft?: string;
  upstreamNodes?: string[]; // IDs of connected parent nodes
  isAggregator?: boolean; // True when multiple inputs
}

interface GhostNodeProps extends NodeProps {
  data: GhostNodeData;
}

export const GhostNode = memo(({ id, data, selected = false }: GhostNodeProps) => {
  const { deleteElements } = useReactFlow();
  const edges = useEdges();

  // Count incoming edges to determine input slots
  const incomingEdges = useMemo(() => 
    edges.filter((e) => e.target === id),
    [edges, id]
  );

  const hasInputConnection = incomingEdges.length > 0;
  const slotCount = Math.max(incomingEdges.length + 1, 1);

  // Node state
  const isProcessing = data.state === 'processing';
  const isError = data.state === 'error';
  const isReady = data.state === 'ready';

  const config = PROCESSING_CONFIG[data.processingType] || PROCESSING_CONFIG.render;

  // Delete this node
  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    deleteElements({ nodes: [{ id }] });
  }, [deleteElements, id]);

  // Calculate handle positions vertically distributed
  const getHandleTop = (index: number) => {
    if (slotCount === 1) return '50%';
    const spacing = 100 / (slotCount + 1);
    return `${spacing * (index + 1)}%`;
  };

  return (
    <div 
      className={`ghost-node minimal ${selected ? 'selected' : ''} ${isProcessing ? 'processing' : ''} ${isError ? 'error' : ''}`}
      style={{ '--ghost-color': config.color } as React.CSSProperties}
    >
      {/* Multiple Input Handles on Left Side */}
      {Array.from({ length: slotCount }, (_, i) => (
        <Handle
          key={`ghost-target-${i}`}
          type="target"
          position={Position.Left}
          id={`ghost-target-${i}`}
          className="ghost-handle ghost-handle--input"
          style={{ top: getHandleTop(i) }}
          isConnectable={!isProcessing}
        />
      ))}

      {/* Visual Area - only content visible */}
      <div className="ghost-visual ghost-empty">
        {/* Eraser button to delete node */}
        <button 
          className="ghost-eraser-btn" 
          onClick={handleDelete}
          title="Delete node"
        >
          <Eraser size={14} />
        </button>

        <div className="ghost-placeholder">
          <ImageIcon size={32} />
          <span>{hasInputConnection ? 'Ready for prompt' : 'Connect inputs'}</span>
        </div>

        {/* Processing Overlay */}
        {isProcessing && (
          <div className="ghost-processing-overlay">
            <Loader2 size={24} className="spin" />
            <span>Processing...</span>
          </div>
        )}

        {isError && (
          <div className="ghost-error-overlay">
            <AlertCircle size={24} />
            <span>Error</span>
            {data.errorMessage && (
              <span className="ghost-error-detail">{data.errorMessage}</span>
            )}
            {data.onRetry && (
              <button 
                className="ghost-retry-btn" 
                onClick={(e) => {
                  e.stopPropagation();
                  data.onRetry?.();
                }}
              >
                <RefreshCw size={12} />
                Retry
              </button>
            )}
          </div>
        )}
      </div>

      {/* Output Handle on Right Side */}
      <Handle
        type="source"
        position={Position.Right}
        id="ghost-source"
        className="ghost-handle ghost-handle--output"
        isConnectable={isReady && !isProcessing}
      />
    </div>
  );
});

export default GhostNode;
