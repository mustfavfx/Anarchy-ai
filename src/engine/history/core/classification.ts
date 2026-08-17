/**
 * History Engine v3 — Canonical Classification System
 */

export const OperationType = {
  Generate: 'generate',
  Render: 'render',
  Upscale: 'upscale',
  Variation: 'variation',
  Edit: 'edit',
} as const;
export type OperationType = (typeof OperationType)[keyof typeof OperationType];

export const NodeRole = {
  Source: 'source',
  Ghost: 'ghost',
  Result: 'result',
  Dummy: 'dummy',
  Group: 'group',
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
