import type { NodeTreeData } from '../../../types/history';

export interface CanvasSessionPayload {
  sessionId: string;
  kind: 'image' | 'nodeTree';
  image?: string;
  nodeTree?: NodeTreeData;
  source: string;
  label?: string;
  prompt?: string;
  model?: string;
  entryId?: string;
  createdAt: number;
}

export class CanvasSessionManager {
  private static sessions: Map<string, CanvasSessionPayload> = new Map();
  private static activeSessionId: string = 'default';
  private static readySessions: Set<string> = new Set();

  static createSession(sessionId: string = 'default'): string {
    this.activeSessionId = sessionId;
    return sessionId;
  }

  static setActiveSession(sessionId: string): void {
    this.activeSessionId = sessionId;
  }

  static getActiveSessionId(): string {
    return this.activeSessionId;
  }

  static setPendingPayload(payload: Omit<CanvasSessionPayload, 'sessionId' | 'createdAt'>, sessionId?: string): void {
    const targetSession = sessionId || this.activeSessionId;
    const fullPayload: CanvasSessionPayload = {
      ...payload,
      sessionId: targetSession,
      createdAt: Date.now(),
    };
    this.sessions.set(targetSession, fullPayload);
    this.readySessions.delete(targetSession);
  }

  static consumePendingPayload(sessionId?: string): CanvasSessionPayload | null {
    const targetSession = sessionId || this.activeSessionId;
    const payload = this.sessions.get(targetSession) || null;
    if (payload) {
      this.sessions.delete(targetSession);
    }
    return payload;
  }

  static signalSessionReady(sessionId?: string): void {
    const targetSession = sessionId || this.activeSessionId;
    this.readySessions.add(targetSession);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(`anarchy:canvas-session-ready:${targetSession}`));
    }
  }

  static isSessionReady(sessionId?: string): boolean {
    const targetSession = sessionId || this.activeSessionId;
    return this.readySessions.has(targetSession);
  }

  static clear(): void {
    this.sessions.clear();
    this.readySessions.clear();
  }
}
