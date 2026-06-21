/**
 * VizGhostAttachEdge - Custom edge for AI processing graph
 * 
 * Features:
 * - Smooth bezier curves (no corners)
 * - Brand red dashed lines
 * - Glow effect when data is flowing
 * - Arrow markers showing direction
 */

import React, { memo } from 'react';
import { 
  BaseEdge, 
  type EdgeProps,
  Position
} from '@xyflow/react';
// Manual bezier path calculation to avoid getBezierPath/getControlWithCurvature errors
function getBezierPathManual(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  sourcePosition: Position = Position.Right,
  targetPosition: Position = Position.Left,
  curvature: number = 0.5
): [string, number, number] {
  const distanceX = Math.abs(targetX - sourceX);
  const distanceY = Math.abs(targetY - sourceY);
  
  // Control point offset based on distance and curvature
  const offset = Math.max(distanceX, distanceY) * curvature;
  
  let sourceControlX: number;
  let sourceControlY: number;
  let targetControlX: number;
  let targetControlY: number;
  
  // Calculate control points based on handle positions
  switch (sourcePosition) {
    case Position.Left:
      sourceControlX = sourceX - offset;
      sourceControlY = sourceY;
      break;
    case Position.Right:
      sourceControlX = sourceX + offset;
      sourceControlY = sourceY;
      break;
    case Position.Top:
      sourceControlX = sourceX;
      sourceControlY = sourceY - offset;
      break;
    case Position.Bottom:
      sourceControlX = sourceX;
      sourceControlY = sourceY + offset;
      break;
    default:
      sourceControlX = sourceX + offset;
      sourceControlY = sourceY;
  }
  
  switch (targetPosition) {
    case Position.Left:
      targetControlX = targetX - offset;
      targetControlY = targetY;
      break;
    case Position.Right:
      targetControlX = targetX + offset;
      targetControlY = targetY;
      break;
    case Position.Top:
      targetControlX = targetX;
      targetControlY = targetY - offset;
      break;
    case Position.Bottom:
      targetControlX = targetX;
      targetControlY = targetY + offset;
      break;
    default:
      targetControlX = targetX - offset;
      targetControlY = targetY;
  }
  
  const path = `M ${sourceX} ${sourceY} C ${sourceControlX} ${sourceControlY}, ${targetControlX} ${targetControlY}, ${targetX} ${targetY}`;
  
  // Label position at midpoint
  const labelX = (sourceX + targetX) / 2;
  const labelY = (sourceY + targetY) / 2;
  
  return [path, labelX, labelY];
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
}: EdgeProps) => {
  // Always use smooth bezier curve to prevent path shape flipping/flickering
  const [edgePath] = getBezierPathManual(
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    0.35 // Perfect curve balance (not too tight, not too loose)
  );

  // Define static styles; visual overrides (opacity, strokeWidth, dasharray) are applied in CSS via parent classes during dragging.
  const edgeStyle: React.CSSProperties = {
    ...style,
    strokeWidth: 2,
    stroke: '#e11d48', // Brand red
    opacity: 0.8,
    strokeDasharray: '5 5',
    strokeLinecap: 'round',
    filter: 'none', // No glow effect
  };

  return (
    <>
      {/* Base edge */}
      <BaseEdge 
        id={id} 
        path={edgePath} 
        style={edgeStyle} 
        markerEnd={markerEnd}
      />
    </>
  );
});

export default VizGhostAttachEdge;
