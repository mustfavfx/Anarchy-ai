import type { NodeTreeData } from '@/types/history';
import type { Command } from './types';

export type CanvasHandoffPayload =
  | { kind: 'image'; image: string; source: string; label: string; prompt: string; model: string }
  | { kind: 'nodeTree'; nodeTree: NodeTreeData; source: string; entryId: string }
  | { kind: 'singleNode'; nodeTree: NodeTreeData; nodeId: string; source: string; attachToNodeId?: string };

export type CanvasSessionLifecycleState = 'idle' | 'restoring';

export interface RestoreProgressState {
  done: number;
  total: number;
  currentNodeId?: string;
  startedAt: number;
}

export interface CanvasSessionMetrics {
  restoreCount: number;
  lastRestoreDurationMs: number | null;
}

interface CanvasSession {
  id: string;
  state: CanvasSessionLifecycleState;
  pendingQueue: CanvasHandoffPayload[];
  isReady: boolean;
  readyListeners: Set<() => void>;
  restoreState: RestoreProgressState | null;
  activeCommand: Command | null;
  abortController: AbortController | null;
  createdAt: number;
  metrics: CanvasSessionMetrics;
}

const DEFAULT_READY_TIMEOUT_MS = 4000;
const sessions = new Map<string, CanvasSession>();

function getSession(sessionId: string): CanvasSession {
  let s = sessions.get(sessionId);
  if (!s) {
    s = {
      id: sessionId,
      state: 'idle',
      pendingQueue: [],
      isReady: false,
      readyListeners: new Set(),
      restoreState: null,
      activeCommand: null,
      abortController: null,
      createdAt: Date.now(),
      metrics: { restoreCount: 0, lastRestoreDurationMs: null },
    };
    sessions.set(sessionId, s);
  }
  return s;
}

export class CanvasSessionManager {
  static setPending(sessionId: string, payload: CanvasHandoffPayload): void {
    const s = getSession(sessionId);
    s.pendingQueue.push(payload);
    s.isReady = false;
  }

  static consumePending(sessionId: string): CanvasHandoffPayload | null {
    const s = getSession(sessionId);
    return s.pendingQueue.shift() ?? null;
  }

  static hasPending(sessionId: string): boolean {
    return getSession(sessionId).pendingQueue.length > 0;
  }

  static pendingCount(sessionId: string): number {
    return getSession(sessionId).pendingQueue.length;
  }

  static signalReady(sessionId: string): void {
    const s = getSession(sessionId);
    s.isReady = true;
    s.readyListeners.forEach(fn => fn());
    s.readyListeners.clear();
  }

  static waitForReady(sessionId: string, timeoutMs: number = DEFAULT_READY_TIMEOUT_MS): Promise<void> {
    const s = getSession(sessionId);
    if (s.isReady) return Promise.resolve();

    return new Promise(resolve => {
      const onReady = () => {
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(() => {
        s.readyListeners.delete(onReady);
        resolve();
      }, timeoutMs);
      s.readyListeners.add(onReady);
    });
  }

  static beginRestore(sessionId: string, totalNodes: number): AbortController {
    const s = getSession(sessionId);
    const controller = new AbortController();
    s.state = 'restoring';
    s.abortController = controller;
    s.restoreState = { done: 0, total: totalNodes, startedAt: Date.now() };
    return controller;
  }

  static updateRestoreProgress(sessionId: string, done: number, total: number, currentNodeId?: string): void {
    const s = getSession(sessionId);
    if (!s.restoreState) return;
    s.restoreState.done = done;
    s.restoreState.total = total;
    s.restoreState.currentNodeId = currentNodeId;
  }

  static endRestore(sessionId: string): void {
    const s = getSession(sessionId);
    const startedAt = s.restoreState?.startedAt;
    s.state = 'idle';
    s.abortController = null;
    s.metrics.restoreCount++;
    s.metrics.lastRestoreDurationMs = startedAt ? Date.now() - startedAt : null;
    s.restoreState = null;
  }

  static isRestoring(sessionId: string): boolean {
    return getSession(sessionId).state === 'restoring';
  }

  static getRestoreProgress(sessionId: string): RestoreProgressState | null {
    return getSession(sessionId).restoreState;
  }

  static cancelRestore(sessionId: string): void {
    getSession(sessionId).abortController?.abort();
  }

  static setActiveCommand(sessionId: string, command: Command | null): void {
    getSession(sessionId).activeCommand = command;
  }

  static getActiveCommand(sessionId: string): Command | null {
    return getSession(sessionId).activeCommand;
  }

  static getMetrics(sessionId: string): CanvasSessionMetrics {
    return { ...getSession(sessionId).metrics };
  }

  static listSessionIds(): string[] {
    return Array.from(sessions.keys());
  }

  static endSession(sessionId: string): void {
    const s = sessions.get(sessionId);
    s?.abortController?.abort();
    sessions.delete(sessionId);
  }

  static _resetForTests(): void {
    sessions.clear();
  }
}
