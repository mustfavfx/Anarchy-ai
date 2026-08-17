export interface HistoryCommand {
  id: string;
  description: string;
  execute(): void | Promise<void>;
  undo(): void | Promise<void>;
}

export class CommandService {
  private undoStack: HistoryCommand[] = [];
  private redoStack: HistoryCommand[] = [];
  private maxHistorySize = 100;

  public async executeCommand(command: HistoryCommand): Promise<void> {
    await command.execute();
    this.undoStack.push(command);
    if (this.undoStack.length > this.maxHistorySize) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  public async undo(): Promise<boolean> {
    const cmd = this.undoStack.pop();
    if (!cmd) return false;
    await cmd.undo();
    this.redoStack.push(cmd);
    return true;
  }

  public async redo(): Promise<boolean> {
    const cmd = this.redoStack.pop();
    if (!cmd) return false;
    await cmd.execute();
    this.undoStack.push(cmd);
    return true;
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}
