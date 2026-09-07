/**
 * Canonical classification types for the History / Canvas system.
 *
 * Consolidates previously-overlapping string unions:
 *   - OperationType: what AI/processing operation produced something
 *   - NodeRole:      what structural role a node plays inside a canvas graph
 *   - NodeState:     lifecycle state of a node
 */

export const OperationType = {
  Generate: 'generate',
  Render: 'render',
  Upscale: 'upscale',
  Variation: 'variation',
  Edit: 'edit',
  Source: 'source',
  Inpaint: 'inpaint',
  Local: 'local',
  Video: 'video',
  Detail: 'detail',
  People: 'people',
  Daynight: 'daynight',
  Lighting: 'lighting',
  Material: 'material',
  Canvas: 'canvas',
  Pinboard: 'pinboard',
  Variations: 'variations',
  Upscales: 'upscales',
  Edits: 'edits',
} as const;
export type OperationType = (typeof OperationType)[keyof typeof OperationType];

export const NodeRole = {
  Source: 'source',
  Ghost: 'ghost',
  Result: 'result',
  Dummy: 'dummy',
  Group: 'group',
  Canvas: 'canvas',
  Edit: 'edit',
  Upscale: 'upscale',
  Variation: 'variation',
} as const;
export type NodeRole = (typeof NodeRole)[keyof typeof NodeRole];

export const NodeState = {
  Idle: 'idle',
  Connecting: 'connecting',
  Queued: 'queued',
  Processing: 'processing',
  Ready: 'ready',
  Completed: 'completed',
  Error: 'error',
  Failed: 'failed',
  Cancelled: 'cancelled',
} as const;
export type NodeState = (typeof NodeState)[keyof typeof NodeState];

const OPERATION_TYPE_VALUES = new Set<string>(Object.values(OperationType));
const NODE_ROLE_VALUES = new Set<string>(Object.values(NodeRole));
const NODE_STATE_VALUES = new Set<string>(Object.values(NodeState));

export function isOperationType(value: string): value is OperationType {
  return OPERATION_TYPE_VALUES.has(value);
}

export function isNodeRole(value: string): value is NodeRole {
  return NODE_ROLE_VALUES.has(value);
}

export function isNodeState(value: string): value is NodeState {
  return NODE_STATE_VALUES.has(value);
}

export function toOperationType(
  raw: string | undefined | null,
  fallback: OperationType = OperationType.Generate
): OperationType {
  if (raw && isOperationType(raw)) return raw;
  return fallback;
}

export function toNodeRole(
  raw: string | undefined | null,
  fallback: NodeRole = NodeRole.Result
): NodeRole {
  if (raw && isNodeRole(raw)) return raw;
  return fallback;
}
