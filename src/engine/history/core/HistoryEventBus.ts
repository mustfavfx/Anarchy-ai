import type { HistoryEntry } from '../../../types/history';

export interface HistoryAddedEvent {
  type: 'HistoryAdded';
  entry: HistoryEntry;
  timestamp: number;
}

export interface HistoryRemovedEvent {
  type: 'HistoryRemoved';
  id: string;
  timestamp: number;
}

export interface HistoryUpdatedEvent {
  type: 'HistoryUpdated';
  entry: HistoryEntry;
  timestamp: number;
}

export interface CanvasRestoredEvent {
  type: 'CanvasRestored';
  entryId: string;
  hasFullTree: boolean;
  timestamp: number;
}

export interface BranchCreatedEvent {
  type: 'BranchCreated';
  rootId: string;
  branchId: string;
  timestamp: number;
}

export interface SnapshotCreatedEvent {
  type: 'SnapshotCreated';
  snapshotId: string;
  timestamp: number;
}

export interface ValidationFailedEvent {
  type: 'ValidationFailed';
  entryId: string;
  errors: string[];
  timestamp: number;
}

export interface CommandExecutedEvent {
  type: 'CommandExecuted';
  commandId: string;
  description: string;
  timestamp: number;
}

export interface MigrationFinishedEvent {
  type: 'MigrationFinished';
  payload: { totalCount: number };
  timestamp: number;
}

export interface EngineReadyEvent {
  type: 'EngineReady';
  seededCount: number;
  timestamp: number;
}

export type TypedHistoryEvent =
  | HistoryAddedEvent
  | HistoryRemovedEvent
  | HistoryUpdatedEvent
  | CanvasRestoredEvent
  | BranchCreatedEvent
  | SnapshotCreatedEvent
  | ValidationFailedEvent
  | CommandExecutedEvent
  | MigrationFinishedEvent
  | EngineReadyEvent;

export type HistoryEventType = TypedHistoryEvent['type'];

export class HistoryEventBus {
  private static instance: HistoryEventBus;
  private listeners: Map<HistoryEventType, Set<(event: TypedHistoryEvent) => void>> = new Map();
  private globalListeners: Set<(event: TypedHistoryEvent) => void> = new Set();

  private constructor() {}

  public static getInstance(): HistoryEventBus {
    if (!HistoryEventBus.instance) {
      HistoryEventBus.instance = new HistoryEventBus();
    }
    return HistoryEventBus.instance;
  }

  public emit(event: TypedHistoryEvent): void {
    const typeListeners = this.listeners.get(event.type);
    if (typeListeners) {
      typeListeners.forEach(fn => fn(event));
    }
    this.globalListeners.forEach(fn => fn(event));
  }

  public on<T extends TypedHistoryEvent>(
    type: T['type'],
    listener: (event: T) => void
  ): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener as any);
    return () => this.listeners.get(type)?.delete(listener as any);
  }

  public onAny(listener: (event: TypedHistoryEvent) => void): () => void {
    this.globalListeners.add(listener);
    return () => this.globalListeners.delete(listener);
  }

  public clear(): void {
    this.listeners.clear();
    this.globalListeners.clear();
  }
}
