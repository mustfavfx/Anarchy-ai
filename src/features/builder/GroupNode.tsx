import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { LayoutGrid, Trash2, FolderKanban, Sparkles } from 'lucide-react';
import type { BuilderNodeData } from './types';
import './GroupNode.css';

export const GroupNode: React.FC<NodeProps> = memo(({ data, selected }) => {
  const nodeData = data as unknown as BuilderNodeData;
  const title = nodeData.groupTitle || nodeData.label || 'مجموعة المعالجة المعمارية';
  const childrenCount = nodeData.groupChildren?.length || 0;
  const groupColor = nodeData.groupColor || '#e11d48';

  return (
    <div
      className={`group-node-container ${selected ? 'selected' : ''}`}
      style={{ borderColor: groupColor }}
    >
      {/* Target Handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="target"
        className="group-node-handle target"
      />

      {/* Header Bar */}
      <div className="group-node-header">
        <div className="group-node-title-group">
          <FolderKanban size={15} style={{ color: groupColor }} />
          <span className="group-node-title-text">{title}</span>
          <span className="group-node-count-badge">{childrenCount} عقد</span>
        </div>

        <div className="group-node-actions">
          {/* Arrange Nodes Grid Animated Button */}
          <button
            type="button"
            className="group-action-btn arrange-btn"
            onClick={(e) => {
              e.stopPropagation();
              nodeData.onArrangeGroup?.();
            }}
            title="إعادة الترتيب التلقائي الشبكي للنودات | Arrange Nodes Inside Group (Grid Layout)"
          >
            <LayoutGrid size={13} />
            <span>ترتيب شبكي</span>
          </button>

          {/* Delete Group Button */}
          {nodeData.onDelete && (
            <button
              type="button"
              className="group-action-btn delete-btn"
              onClick={(e) => {
                e.stopPropagation();
                nodeData.onDelete?.();
              }}
              title="حذف المجموعة"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Group Interior Label Overlay */}
      <div className="group-node-body">
        <div className="group-watermark">
          <Sparkles size={18} style={{ opacity: 0.15, color: groupColor }} />
          <span>مساحة الحاوية التجميعية</span>
        </div>
      </div>

      {/* Source Handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="source"
        className="group-node-handle source"
      />
    </div>
  );
});

GroupNode.displayName = 'GroupNode';
