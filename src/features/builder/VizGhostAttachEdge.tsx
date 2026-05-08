/**
 * VizGhostAttachEdge - Custom edge for AI processing graph
 * 
 * Features:
 * - Smooth bezier curves with 0.16 curvature
 * - Visually "plugs into" node handle
 * - Glow effect when data is flowing
 * - Arrow markers showing direction
 */

import React, { memo } from 'react';
import { 
  BaseEdge, 
  EdgeLabelRenderer, 
  type EdgeProps,
  getSmoothStepPath
} from '@xyflow/react';
import type { DataPacket } from './types';

interface EdgeData {
  packet?: DataPacket;
  isActive: boolean;
  lastUpdate: number;
}

const VizGhostAttachEdge = memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: EdgeProps) => {
  const { packet, isActive } = (data as unknown as EdgeData) || {};
  
  // Generate smooth path
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 16,
    offset: 0,
  });

  // Determine visual state
  const hasData = !!packet?.image;
  const isFlowing = isActive && hasData;
  
  // Dynamic styles based on data state
  const edgeStyle: React.CSSProperties = {
    ...style,
    strokeWidth: isFlowing ? 3 : 2,
    stroke: isFlowing 
      ? 'rgba(59, 130, 246, 0.8)' // Blue glow for data flow
      : 'rgba(255, 255, 255, 0.3)',
    opacity: hasData ? 1 : 0.4,
    filter: isFlowing ? 'drop-shadow(0 0 4px rgba(59, 130, 246, 0.6))' : 'none',
    transition: 'all 0.3s ease',
  };

  // Animated dash pattern for flowing data
  const animatedStyle: React.CSSProperties = isFlowing ? {
    strokeDasharray: '8 4',
    animation: 'edgeFlow 1s linear infinite',
  } : {};

  return (
    <>
      {/* Base edge */}
      <BaseEdge 
        id={id} 
        path={edgePath} 
        style={{ ...edgeStyle, ...animatedStyle }} 
        markerEnd={markerEnd}
      />
      
      {/* Glow layer when active */}
      {isFlowing && (
        <BaseEdge
          id={`${id}-glow`}
          path={edgePath}
          style={{
            stroke: 'rgba(59, 130, 246, 0.3)',
            strokeWidth: 8,
            fill: 'none',
            filter: 'blur(4px)',
            opacity: 0.6,
          }}
        />
      )}

      {/* Data packet indicator */}
      <EdgeLabelRenderer>
        {isFlowing && (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              fontSize: 10,
              fontWeight: 600,
              pointerEvents: 'none',
              color: 'rgba(59, 130, 246, 0.9)',
              background: 'rgba(0, 0, 0, 0.6)',
              padding: '2px 6px',
              borderRadius: 4,
              border: '1px solid rgba(59, 130, 246, 0.4)',
            }}
          >
            {packet?.metadata.operationType}
          </div>
        )}
      </EdgeLabelRenderer>

      {/* CSS for animation */}
      <style>{`
        @keyframes edgeFlow {
          from {
            stroke-dashoffset: 12;
          }
          to {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </>
  );
});

export default VizGhostAttachEdge;
