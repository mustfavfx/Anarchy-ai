import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { LayoutGrid, Trash2, FolderKanban, Sparkles } from 'lucide-react';
import type { BuilderNodeData } from './types';
import { useTranslation } from '../../services/i18n';
import './GroupNode.css';

export const GroupNode: React.FC<NodeProps> = memo(({ data, selected }) => {
  const { t } = useTranslation();
  const nodeData = data as unknown as BuilderNodeData;
  const title = nodeData.groupTitle || nodeData.label || t('builder.groupTitle', 'Architectural Processing Group');
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

      {/* Group Header Bar */}
      <div className="group-node-header" style={{ backgroundColor: groupColor }}>
        <div className="group-node-header-left">
          <FolderKanban size={14} className="group-icon" />
          <span className="group-node-title">{title}</span>
          <span className="group-node-badge">
            {childrenCount} {childrenCount === 1 ? 'node' : 'nodes'}
          </span>
        </div>

        <div className="group-node-header-actions">
          {/* Arrange Nodes Grid Animated Button */}
          <button
            type="button"
            className="group-action-btn arrange-btn"
            onClick={(e) => {
              e.stopPropagation();
              nodeData.onArrangeGroup?.();
            }}
            title={t('builder.autoArrange', 'Auto Arrange Nodes (Grid Layout)')}
            aria-label={t('builder.autoArrange', 'Auto Arrange Nodes (Grid Layout)')}
          >
            <LayoutGrid size={13} />
            <span>{t('builder.gridArrange', 'Grid Arrange')}</span>
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
              title={t('builder.deleteGroup', 'Delete Group')}
              aria-label={t('builder.deleteGroup', 'Delete Group')}
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
          <span>{t('builder.groupContainer', 'Group Container')}</span>
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
