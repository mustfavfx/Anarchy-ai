/**
 * Canonical Command.type strings.
 */
export const CommandType = {
  NodeCreate: 'node:create',
  NodeMove: 'node:move',
  NodeDelete: 'node:delete',
  NodeUpdate: 'node:update',
  NodeConnect: 'node:connect',
  NodeDisconnect: 'node:disconnect',
  TreeRestore: 'tree:restore',
  NodeRestore: 'node:restore',
} as const;
export type CommandType = (typeof CommandType)[keyof typeof CommandType];

const COMMAND_TYPE_VALUES = new Set<string>(Object.values(CommandType));

export function isCommandType(value: string): value is CommandType {
  return COMMAND_TYPE_VALUES.has(value);
}
