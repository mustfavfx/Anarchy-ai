/**
 * Canonical classification types for the History / Canvas system.
 *
 * Consolidates 4 previously-overlapping, independently-defined string
 * unions that lived scattered across the codebase:
 *
 *   - HistoryEntry.type                    ('render'|'upscale'|'variation'|'edit'|'generate')
 *   - HistoryEntry.nodeType                ('source'|'variation'|'upscale'|'edit'|'canvas')
 *   - NodeTreeData.nodes[].type             ('source'|'ghost'|'result'|'dummy'|'group')
 *   - NodeTreeData.nodes[].processingType   (free string, no type at all)
 *
 * These collapse into two real concepts:
 *   - OperationType: what AI/processing operation produced something
 *   - NodeRole:      what structural role a node plays inside a canvas graph
 * (`NodeState` is included too since it was the 3rd loosely-typed field
 * on tree nodes and belongs in the same file.)
 *
 * Implemented as `const` objects + derived literal-union types rather
 * than TypeScript `enum`. This keeps them 100% assignment-compatible
 * with plain string values already sitting in persisted JSON / other
 * files in the app — existing code doing `entry.type === 'render'`
 * keeps working with zero casts.
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
