import type { HistoryEntry } from '../../../types/history';

export interface CommandContext {
  historyEngine: any;
  navigate?: (path: string) => void;
}

export abstract class BaseCommand {
  abstract id: string;
  abstract description: string;
  abstract execute(context: CommandContext): Promise<void>;
  abstract undo(context: CommandContext): Promise<void>;
}

export class GenerateCommand extends BaseCommand {
  id = `gen_cmd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  description = 'Generate Image Command';

  constructor(private entry: HistoryEntry) {
    super();
  }

  async execute(context: CommandContext): Promise<void> {
    await context.historyEngine.addEntry(this.entry);
  }

  async undo(context: CommandContext): Promise<void> {
    await context.historyEngine.removeEntry(this.entry.id);
  }
}

export class DeleteCommand extends BaseCommand {
  id = `del_cmd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  description = 'Delete History Item Command';
  private backupEntry?: HistoryEntry;

  constructor(private entryId: string) {
    super();
  }

  async execute(context: CommandContext): Promise<void> {
    this.backupEntry = await context.historyEngine.getById(this.entryId);
    await context.historyEngine.removeEntry(this.entryId);
  }

  async undo(context: CommandContext): Promise<void> {
    if (this.backupEntry) {
      await context.historyEngine.addEntry(this.backupEntry);
    }
  }
}

export class RestoreCommand extends BaseCommand {
  id = `restore_cmd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  description = 'Restore Graph Command';

  constructor(private entry: HistoryEntry) {
    super();
  }

  async execute(context: CommandContext): Promise<void> {
    if (context.navigate) {
      context.historyEngine.restoreEntry(this.entry, context.navigate);
    }
  }

  async undo(_context: CommandContext): Promise<void> {
    // Undo handling via ReactFlow history stack
  }
}

export class RenameCommand extends BaseCommand {
  id = `rename_cmd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  description = 'Rename Entry Command';
  private oldLabel?: string;

  constructor(private entryId: string, private newLabel: string) {
    super();
  }

  async execute(context: CommandContext): Promise<void> {
    const entry = await context.historyEngine.getById(this.entryId);
    if (entry) {
      this.oldLabel = entry.label;
      entry.label = this.newLabel;
      await context.historyEngine.addEntry(entry);
    }
  }

  async undo(context: CommandContext): Promise<void> {
    if (this.oldLabel) {
      const entry = await context.historyEngine.getById(this.entryId);
      if (entry) {
        entry.label = this.oldLabel;
        await context.historyEngine.addEntry(entry);
      }
    }
  }
}

export class UpdatePromptCommand extends BaseCommand {
  id = `prompt_cmd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  description = 'Update Prompt Command';
  private oldPrompt?: string;

  constructor(private entryId: string, private newPrompt: string) {
    super();
  }

  async execute(context: CommandContext): Promise<void> {
    const entry = await context.historyEngine.getById(this.entryId);
    if (entry) {
      this.oldPrompt = entry.prompt;
      entry.prompt = this.newPrompt;
      await context.historyEngine.addEntry(entry);
    }
  }

  async undo(context: CommandContext): Promise<void> {
    if (this.oldPrompt !== undefined) {
      const entry = await context.historyEngine.getById(this.entryId);
      if (entry) {
        entry.prompt = this.oldPrompt;
        await context.historyEngine.addEntry(entry);
      }
    }
  }
}

export class CommandEngine {
  private undoStack: BaseCommand[] = [];
  private redoStack: BaseCommand[] = [];
  private maxStackSize = 100;

  async execute(command: BaseCommand, context: CommandContext): Promise<void> {
    await command.execute(context);
    this.undoStack.push(command);
    if (this.undoStack.length > this.maxStackSize) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  async undo(context: CommandContext): Promise<boolean> {
    const cmd = this.undoStack.pop();
    if (!cmd) return false;
    await cmd.undo(context);
    this.redoStack.push(cmd);
    return true;
  }

  async redo(context: CommandContext): Promise<boolean> {
    const cmd = this.redoStack.pop();
    if (!cmd) return false;
    await cmd.execute(context);
    this.undoStack.push(cmd);
    return true;
  }
}
