import type { Command } from './types';
import { CommandType } from './CommandTypes';

export interface NodeSnapshot {
  id: string;
  role: string;
  position: { x: number; y: number };
  image?: string;
  prompt?: string;
  parentId?: string;
}

/**
 * Builds Commands for canvas edits.
 */
export class CanvasCommandFactory {
  static buildCreate(sessionId: string, node: NodeSnapshot): Command {
    return {
      id: `cmd_${sessionId}_${Date.now()}`,
      sessionId,
      timestamp: Date.now(),
      type: CommandType.NodeCreate,
      payload: { node },
      inverse: { removeNodeIds: [node.id] },
      label: 'Create node',
    };
  }

  static buildDelete(sessionId: string, node: NodeSnapshot): Command {
    return {
      id: `cmd_${sessionId}_${Date.now()}`,
      sessionId,
      timestamp: Date.now(),
      type: CommandType.NodeDelete,
      payload: { removeNodeIds: [node.id] },
      inverse: { node },
      label: 'Delete node',
    };
  }

  static buildMove(
    sessionId: string,
    nodeId: string,
    from: { x: number; y: number },
    to: { x: number; y: number }
  ): Command {
    return {
      id: `cmd_${sessionId}_${Date.now()}`,
      sessionId,
      timestamp: Date.now(),
      type: CommandType.NodeMove,
      payload: { nodeId, position: to },
      inverse: { nodeId, position: from },
      label: 'Move node',
    };
  }

  static buildUpdate<T extends Record<string, unknown>>(
    sessionId: string,
    nodeId: string,
    before: T,
    after: T
  ): Command {
    return {
      id: `cmd_${sessionId}_${Date.now()}`,
      sessionId,
      timestamp: Date.now(),
      type: CommandType.NodeUpdate,
      payload: { nodeId, changes: after },
      inverse: { nodeId, changes: before },
      label: 'Edit node',
    };
  }

  static buildConnect(sessionId: string, parentId: string, childId: string): Command {
    return {
      id: `cmd_${sessionId}_${Date.now()}`,
      sessionId,
      timestamp: Date.now(),
      type: CommandType.NodeConnect,
      payload: { parentId, childId },
      inverse: { parentId, childId },
      label: 'Connect nodes',
    };
  }

  static buildDisconnect(sessionId: string, parentId: string, childId: string): Command {
    return {
      id: `cmd_${sessionId}_${Date.now()}`,
      sessionId,
      timestamp: Date.now(),
      type: CommandType.NodeDisconnect,
      payload: { parentId, childId },
      inverse: { parentId, childId },
      label: 'Disconnect nodes',
    };
  }
}

export function createCanvasCommandExecutor(factory: {
  createNode(node: NodeSnapshot): void | Promise<void>;
  removeNode(nodeId: string): void | Promise<void>;
  moveNode(nodeId: string, position: { x: number; y: number }): void | Promise<void>;
  updateNode(nodeId: string, changes: Record<string, unknown>): void | Promise<void>;
  connect(parentId: string, childId: string): void | Promise<void>;
  disconnect(parentId: string, childId: string): void | Promise<void>;
}) {
  return {
    async apply(command: Command) {
      switch (command.type) {
        case CommandType.NodeCreate:
          return factory.createNode((command.payload as { node: NodeSnapshot }).node);
        case CommandType.NodeDelete:
          for (const id of (command.payload as { removeNodeIds: string[] }).removeNodeIds) {
            await factory.removeNode(id);
          }
          return;
        case CommandType.NodeMove: {
          const { nodeId, position } = command.payload as { nodeId: string; position: { x: number; y: number } };
          return factory.moveNode(nodeId, position);
        }
        case CommandType.NodeUpdate: {
          const { nodeId, changes } = command.payload as { nodeId: string; changes: Record<string, unknown> };
          return factory.updateNode(nodeId, changes);
        }
        case CommandType.NodeConnect: {
          const { parentId, childId } = command.payload as { parentId: string; childId: string };
          return factory.connect(parentId, childId);
        }
        case CommandType.NodeDisconnect: {
          const { parentId, childId } = command.payload as { parentId: string; childId: string };
          return factory.disconnect(parentId, childId);
        }
      }
    },
    async invert(command: Command) {
      switch (command.type) {
        case CommandType.NodeCreate:
          for (const id of (command.inverse as { removeNodeIds: string[] }).removeNodeIds) {
            await factory.removeNode(id);
          }
          return;
        case CommandType.NodeDelete:
          return factory.createNode((command.inverse as { node: NodeSnapshot }).node);
        case CommandType.NodeMove: {
          const { nodeId, position } = command.inverse as { nodeId: string; position: { x: number; y: number } };
          return factory.moveNode(nodeId, position);
        }
        case CommandType.NodeUpdate: {
          const { nodeId, changes } = command.inverse as { nodeId: string; changes: Record<string, unknown> };
          return factory.updateNode(nodeId, changes);
        }
        case CommandType.NodeConnect: {
          const { parentId, childId } = command.inverse as { parentId: string; childId: string };
          return factory.disconnect(parentId, childId);
        }
        case CommandType.NodeDisconnect: {
          const { parentId, childId } = command.inverse as { parentId: string; childId: string };
          return factory.connect(parentId, childId);
        }
      }
    },
  };
}
