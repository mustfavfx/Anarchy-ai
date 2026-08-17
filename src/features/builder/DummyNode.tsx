import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Loader2, XCircle, Wand2, Sparkles } from 'lucide-react';
import type { BuilderNodeData } from './types';
import './DummyNode.css';

export const DummyNode: React.FC<NodeProps> = memo(({ data, selected }) => {
  const nodeData = data as unknown as BuilderNodeData;
  const progress = nodeData.progressPercentage ?? 45;
  const statusMsg = nodeData.statusMessage || 'جارِ المعالجة بالذكاء الاصطناعي...';
  const prompt = nodeData.prompt || nodeData.inputData?.prompt || 'توليد رندر معماري...';

  return (
    <div className={`dummy-node-container ${selected ? 'selected' : ''}`}>
      {/* Target Handle from Source Node */}
      <Handle
        type="target"
        position={Position.Left}
        id="target"
        className="dummy-node-handle target"
      />

      {/* Header */}
      <div className="dummy-node-header">
        <div className="dummy-node-title">
          <Sparkles className="dummy-sparkle-icon" size={14} />
          <span>{nodeData.label || 'نود التوليد المؤقتة'}</span>
        </div>
        <div className="dummy-node-status-badge">
          <Loader2 className="spin" size={13} />
          <span>توليد سحابي</span>
        </div>
      </div>

      {/* Placeholder Media Skeleton */}
      <div className="dummy-node-skeleton">
        <div className="dummy-skeleton-glow" />
        <div className="dummy-skeleton-center">
          <Wand2 className="dummy-wand-icon pulse" size={24} />
          <span className="dummy-prompt-preview">{prompt}</span>
        </div>
      </div>

      {/* Progress Bar & Status Footer */}
      <div className="dummy-node-footer">
        <div className="dummy-progress-bar-track">
          <div
            className="dummy-progress-bar-fill"
            style={{ width: `${Math.min(100, Math.max(5, progress))}%` }}
          />
        </div>
        <div className="dummy-node-status-row">
          <span className="dummy-status-text">{statusMsg}</span>
          <span className="dummy-percentage">{Math.round(progress)}%</span>
        </div>
        {nodeData.onCancel && (
          <button
            type="button"
            className="dummy-cancel-btn"
            onClick={(e) => {
              e.stopPropagation();
              nodeData.onCancel?.();
            }}
            title="إلغاء المعالجة"
          >
            <XCircle size={13} />
            <span>إلغاء</span>
          </button>
        )}
      </div>

      {/* Source Handle to Next Nodes */}
      <Handle
        type="source"
        position={Position.Right}
        id="source"
        className="dummy-node-handle source"
      />
    </div>
  );
});

DummyNode.displayName = 'DummyNode';
