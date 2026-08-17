import type { Command } from './types';

type CommandLogListener = (command: Command) => void;

/**
 * Append-only log of Commands across all canvas sessions.
 */
export class CommandLog {
  private commands: Command[] = [];
  private listeners = new Set<CommandLogListener>();

  append(command: Command): void {
    this.commands.push(command);
    this.listeners.forEach(fn => {
      try {
        fn(command);
      } catch (err) {
        console.error('[CommandLog] onAppend listener threw:', err);
      }
    });
  }

  /** Returns an unsubscribe function. */
  onAppend(listener: CommandLogListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getAll(sessionId?: string): Command[] {
    return sessionId ? this.commands.filter(c => c.sessionId === sessionId) : [...this.commands];
  }

  get length(): number {
    return this.commands.length;
  }

  lengthFor(sessionId: string): number {
    return this.getAll(sessionId).length;
  }

  /**
   * Drops a session's commands after `keepCount`, leaving every other
   * session's commands untouched.
   */
  truncateSessionAfter(sessionId: string, keepCount: number): void {
    let seen = 0;
    this.commands = this.commands.filter(c => {
      if (c.sessionId !== sessionId) return true;
      seen++;
      return seen <= keepCount;
    });
  }

  clear(sessionId?: string): void {
    this.commands = sessionId ? this.commands.filter(c => c.sessionId !== sessionId) : [];
  }
}
