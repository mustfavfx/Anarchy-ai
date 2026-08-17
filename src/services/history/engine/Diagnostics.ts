import type { CommandLog } from './CommandLog';
import { CanvasSessionManager, type CanvasSessionMetrics } from './CanvasSessionManager';

export interface DiagnosticsErrorEntry {
  timestamp: number;
  scope: string;
  message: string;
}

export interface DiagnosticsReport {
  totalCommands: number;
  commandsBySession: Record<string, number>;
  sessionMetrics: Record<string, CanvasSessionMetrics>;
  recentErrors: DiagnosticsErrorEntry[];
  generatedAt: number;
}

const MAX_ERROR_LOG = 200;

export class Diagnostics {
  private errors: DiagnosticsErrorEntry[] = [];

  constructor(private commandLog: CommandLog) {}

  recordError(scope: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.errors.push({ timestamp: Date.now(), scope, message });
    if (this.errors.length > MAX_ERROR_LOG) {
      this.errors.splice(0, this.errors.length - MAX_ERROR_LOG);
    }
  }

  getReport(): DiagnosticsReport {
    const sessionIds = CanvasSessionManager.listSessionIds();
    const commandsBySession: Record<string, number> = {};
    const sessionMetrics: Record<string, CanvasSessionMetrics> = {};

    for (const id of sessionIds) {
      commandsBySession[id] = this.commandLog.lengthFor(id);
      sessionMetrics[id] = CanvasSessionManager.getMetrics(id);
    }

    return {
      totalCommands: this.commandLog.length,
      commandsBySession,
      sessionMetrics,
      recentErrors: [...this.errors],
      generatedAt: Date.now(),
    };
  }

  clearErrors(): void {
    this.errors = [];
  }
}
