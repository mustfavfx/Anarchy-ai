import type { Command, CommandExecutor } from './types';
import { CommandLog } from './CommandLog';

/**
 * Standard undo/redo stack semantics, per canvas session, on top of the
 * shared CommandLog.
 */
export class UndoRedoEngine {
  private cursor = new Map<string, number>();

  constructor(private log: CommandLog, private executor: CommandExecutor) {}

  /** Call after a command has already been applied live on the canvas. */
  record(command: Command): void {
    const sessionLength = this.log.lengthFor(command.sessionId);
    const cursorIndex = this.cursor.get(command.sessionId) ?? sessionLength;

    if (cursorIndex < sessionLength) {
      this.log.truncateSessionAfter(command.sessionId, cursorIndex);
    }

    this.log.append(command);
    this.cursor.set(command.sessionId, cursorIndex + 1);
  }

  async undo(sessionId: string): Promise<boolean> {
    const sessionCommands = this.log.getAll(sessionId);
    const cursorIndex = this.cursor.get(sessionId) ?? sessionCommands.length;
    if (cursorIndex <= 0) return false;

    const command = sessionCommands[cursorIndex - 1];
    await this.executor.invert(command);
    this.cursor.set(sessionId, cursorIndex - 1);
    return true;
  }

  async redo(sessionId: string): Promise<boolean> {
    const sessionCommands = this.log.getAll(sessionId);
    const cursorIndex = this.cursor.get(sessionId) ?? sessionCommands.length;
    if (cursorIndex >= sessionCommands.length) return false;

    const command = sessionCommands[cursorIndex];
    await this.executor.apply(command);
    this.cursor.set(sessionId, cursorIndex + 1);
    return true;
  }

  canUndo(sessionId: string): boolean {
    const sessionCommands = this.log.getAll(sessionId);
    return (this.cursor.get(sessionId) ?? sessionCommands.length) > 0;
  }

  canRedo(sessionId: string): boolean {
    const sessionCommands = this.log.getAll(sessionId);
    return (this.cursor.get(sessionId) ?? sessionCommands.length) < sessionCommands.length;
  }

  /** Reset a session's cursor to its tip. */
  resetCursor(sessionId: string): void {
    this.cursor.set(sessionId, this.log.lengthFor(sessionId));
  }
}
