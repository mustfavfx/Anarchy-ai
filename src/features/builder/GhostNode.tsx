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

import React, { memo, useMemo, useCallback, useEffect, useState } from 'react';
import { Handle, Position, type NodeProps, useReactFlow, useUpdateNodeInternals, useStore } from '@xyflow/react';
import { 
  Loader2, AlertCircle, Eraser, RefreshCw
} from 'lucide-react';
import type { ProcessingType, BuilderNodeData, NodeState } from './types';
import { predictionRealtime, type PredictionStatus } from '../../services/replicate/predictionRealtime';
import { useBuilderQueueStore } from '../../stores/builderQueueStore';
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
  onImageReady?: (imageUrl: string) => void; // Callback when generation completes
  onError?: (error: string) => void; // Callback when generation fails
  onExecute?: (prompt: string) => void; // Callback to run execution inline
}

interface GhostNodeProps extends NodeProps {
  data: GhostNodeData;
}

// Extracted component to avoid nested ternary
interface GhostPlaceholderProps {
  connectedCount: number;
}

const GhostPlaceholder = memo(({ connectedCount }: GhostPlaceholderProps) => {
  let message: string;
  if (connectedCount === 0) {
    message = 'Connect inputs';
  } else if (connectedCount === 1) {
    message = '1 image connected';
  } else {
    message = `${connectedCount} images connected`;
  }

  return (
    <div className="ghost-placeholder">
      <span>{message}</span>
      {connectedCount > 0 && (
        <span className="ghost-input-hint">Ready for generation</span>
      )}
    </div>
  );
});

export const GhostNode = memo(({ id, data, selected = false }: GhostNodeProps) => {
  if (process.env.NODE_ENV === 'development' || (globalThis as any).__DEV__) {
    (globalThis as any).__anarchyNodeRenders = ((globalThis as any).__anarchyNodeRenders || 0) + 1;
  }
  const deleteElements = useReactFlow().deleteElements;

  // ── Granular edge subscription ──────────────────────────────────────────
  // PERF: useEdges() subscribes to ALL canvas edges, causing every GhostNode
  // to re-render on every drag frame. useStore with a per-node selector means
  // this component only re-renders when ITS OWN incoming edges change.
  const incomingEdges = useStore(
    useCallback((s) => s.edges.filter((e) => e.target === id), [id])
  );

  const connectedCount = incomingEdges.length;

  // Find the maximum index among active incoming edges targeting this node
  const maxConnectedIndex = useMemo(() => {
    let maxIdx = -1;
    incomingEdges.forEach(e => {
      const match = e.targetHandle?.match(/ghost-target-(\d+)/);
      if (match) {
        const idx = parseInt(match[1], 10);
        if (idx > maxIdx) {
          maxIdx = idx;
        }
      }
    });
    return maxIdx;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- id is the node ID, stable for the lifetime of this component instance
  }, [incomingEdges]);

  // Render handles up to max connected index + 1 (min 1 slot, max 8 slots)
  const slotCount = Math.min(8, Math.max(1, maxConnectedIndex + 2));

  // Force React Flow to re-measure handles when slot count changes
  const updateNodeInternals = useUpdateNodeInternals();
  useEffect(() => {
    const timer = setTimeout(() => {
      updateNodeInternals(id);
    }, 100);
    return () => clearTimeout(timer);
  }, [id, slotCount, updateNodeInternals]);

  // Central queue job store subscription
  const queueJob = useBuilderQueueStore((s) => s.jobs[id]);

  const activeState = (queueJob?.state || data.state) as NodeState;

  // Node state
  const isConnecting = activeState === 'connecting';
  const isQueued = activeState === 'queued';
  const isProcessing = activeState === 'processing';
  const isError = activeState === 'error' || activeState === 'failed';
  const isReady = activeState === 'ready' || activeState === 'completed';
  const isCancelled = activeState === 'cancelled';

  const predictionId = queueJob?.predictionId || data.predictionId;

  // Realtime subscription state
  const [generationStatus, setGenerationStatus] = useState<PredictionStatus | null>(null);

  // Subscribe to Realtime updates when predictionId is set
  useEffect(() => {
    if (!predictionId || !data.userId) {
      return;
    }

    console.log('[GhostNode] Subscribing to prediction:', predictionId);
    
    predictionRealtime.subscribeToPrediction(
      predictionId,
      id,
      (status) => {
        console.log('[GhostNode] Prediction update:', status);
        setGenerationStatus(status);

        // Sync status to central queue store
        useBuilderQueueStore.getState().updateJob(id, {
          state: status.status === 'pending' ? 'queued' :
                 status.status === 'processing' ? 'processing' :
                 status.status === 'completed' ? 'completed' :
                 status.status === 'failed' ? 'failed' :
                 status.status === 'canceled' ? 'cancelled' : 'idle',
          outputUrl: status.outputUrl || status.storageUrl,
          errorMessage: status.error
        });

        // Call parent's onImageReady callback when completed
        if (status.status === 'completed' && status.storageUrl && data.onImageReady) {
          data.onImageReady(status.storageUrl);
        }

        // Call parent's onError callback when failed
        if (status.status === 'failed' && data.onError && status.error) {
          data.onError(status.error);
        }
      }
    );

    return () => {
      if (predictionId) {
        console.log('[GhostNode] Unsubscribing from prediction:', predictionId);
        predictionRealtime.unsubscribeFromPrediction(predictionId);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- predictionId/id are stable for this prediction trigger
  }, [predictionId, data.userId, id]);

  const config = PROCESSING_CONFIG[data.processingType] || PROCESSING_CONFIG.render;

  // Delete this node
  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    deleteElements({ nodes: [{ id }] });
  }, [deleteElements, id]);

  // Calculate handle positions using FIXED vertical slots.
  // ghost-target-0 is ALWAYS at 35%, ghost-target-1 at 50%, ghost-target-2 at 65%, etc.
  // This prevents React Flow's cached coordinates from going stale when slotCount changes.
  const getHandleTop = (index: number) => {
    const spacing = 15;
    const start = 35;
    return `${start + (spacing * index)}%`;
  };



  return (
    <div 
      className={`ghost-node minimal ${selected ? 'selected' : ''} ${isProcessing ? 'processing' : ''} ${isConnecting ? 'connecting' : ''} ${isQueued ? 'queued' : ''} ${isError ? 'error' : ''} ${isCancelled ? 'cancelled' : ''}`}
      style={{ '--ghost-color': config.color } as React.CSSProperties}
    >
      {/* Hidden fallback target handle to prevent React Flow transition warnings */}
      <Handle 
        type="target" 
        position={Position.Left} 
        id="target" 
        style={{ display: 'none' }} 
        isConnectable={false}
      />

      {/* Multiple Input Handles on Left Side */}
      {Array.from({ length: slotCount }, (_, i) => {
        const labelText = i === 0 ? 'Primary Source' : `Reference Input #${i}`;
        return (
          <Handle
            key={`ghost-target-${i}`}
            type="target"
            position={Position.Left}
            id={`ghost-target-${i}`}
            className="ghost-handle ghost-handle--input"
            style={{
              top: getHandleTop(i),
              left: '-6px',
              right: 'auto',
              transform: 'translateY(-50%)',
            }}
            isConnectable={!isProcessing}
          >
            <span className="ghost-handle-label">{labelText}</span>
          </Handle>
        );
      })}

      {/* Visual Area - only content visible */}
      <div className="ghost-visual ghost-empty">
        {/* Eraser button to delete node */}
        <button 
          type="button"
          className="ghost-eraser-btn" 
          onClick={handleDelete}
          title="Delete node"
        >
          <Eraser size={14} />
        </button>

        <GhostPlaceholder connectedCount={connectedCount} />


        {/* Midjourney style progress thumbnail preview */}
        {(queueJob?.outputUrl || generationStatus?.outputUrl) && (isProcessing || isConnecting || isQueued) && (
          <img 
            src={queueJob?.outputUrl || generationStatus?.outputUrl} 
            className="ghost-preview-image" 
            alt="Progress Preview" 
          />
        )}

        {/* Processing/Connecting Overlay */}
        {(isProcessing || isConnecting || isQueued) && (
          <div className="ghost-processing-overlay">
            <Loader2 size={24} className="spin" />
            <span>
              {isConnecting 
                ? 'Connecting to Model...' 
                : isQueued 
                  ? 'Queued...' 
                  : (generationStatus?.status === 'processing' || isProcessing)
                    ? 'Generating...' 
                    : 'Processing...'}
            </span>
            {(isQueued || isProcessing || generationStatus?.status) && (
              <span className="ghost-status-badge">
                {isQueued 
                  ? 'queued' 
                  : (generationStatus?.status || 'processing')}
              </span>
            )}
            {data.onCancel && (
              <button 
                type="button"
                className="ghost-cancel-btn" 
                onClick={(e) => {
                  e.stopPropagation();
                  data.onCancel?.();
                }}
              >
                Cancel
              </button>
            )}
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
                type="button"
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

        {isCancelled && (
          <div className="ghost-cancelled-overlay">
            <AlertCircle size={24} />
            <span>Cancelled</span>
            {data.errorMessage && (
              <span className="ghost-error-detail">{data.errorMessage}</span>
            )}
            {data.onRetry && (
              <button 
                type="button"
                className="ghost-retry-btn" 
                onClick={(e) => {
                  e.stopPropagation();
                  data.onRetry?.();
                }}
              >
                <RefreshCw size={12} />
                Restart
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
        style={{
          right: '-6px',
          left: 'auto',
          top: '50%',
          bottom: 'auto',
          transform: 'translateY(-50%)',
        }}
      >
        <span className="ghost-handle-label" style={{ left: 'auto', right: '14px' }}>Generated Output</span>
      </Handle>
    </div>
  );
});

export default GhostNode;
