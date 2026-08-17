import type { NodeTreeData } from '../../types/history';

/**
 * Replaces old setTimeout race condition patterns with a dedicated handoff service.
 *
 * 1. Pending-transfer store — the payload is written to memory BEFORE
 *    navigate() is called, so it already exists by the time BuilderPage
 *    mounts. No timing dependency for the payload itself to "arrive".
 *
 * 2. builder-ready signal — BuilderPage calls `signalReady()` once its
 *    canvas has actually finished initializing and it's safe to inject nodes/images.
 */

export type CanvasHandoffPayload =
  | {
      kind: 'image';
      image: string;
      source: string;
      label: string;
      prompt: string;
      model: string;
    }
  | {
      kind: 'nodeTree';
      nodeTree: NodeTreeData;
      source: string;
      entryId: string;
    };

const READY_EVENT = 'anarchy:builder-ready';
const DEFAULT_READY_TIMEOUT_MS = 4000;

let pending: CanvasHandoffPayload | null = null;
let builderIsReady = false;

if (typeof window !== 'undefined') {
  window.addEventListener(READY_EVENT, () => {
    builderIsReady = true;
  });
}

export class CanvasHandoffService {
  /** Call before navigate('/builder'). Stores the payload in memory. */
  static setPending(payload: CanvasHandoffPayload): void {
    pending = payload;
    builderIsReady = false;
  }

  /**
   * Call once from BuilderPage on mount.
   * Returns the payload exactly once and clears it.
   */
  static consumePending(): CanvasHandoffPayload | null {
    const payload = pending;
    pending = null;
    return payload;
  }

  static hasPending(): boolean {
    return pending !== null;
  }

  /** Call from the canvas once it has actually finished initializing. */
  static signalReady(): void {
    builderIsReady = true;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(READY_EVENT));
    }
  }

  /**
   * Resolves once the canvas is ready to safely receive nodes/images.
   * Resolves immediately if already ready.
   */
  static waitForReady(timeoutMs: number = DEFAULT_READY_TIMEOUT_MS): Promise<void> {
    if (builderIsReady) return Promise.resolve();

    return new Promise(resolve => {
      const cleanup = () => {
        window.removeEventListener(READY_EVENT, onReady);
        clearTimeout(timer);
      };
      const onReady = () => {
        cleanup();
        resolve();
      };
      const timer = setTimeout(() => {
        cleanup();
        resolve();
      }, timeoutMs);

      window.addEventListener(READY_EVENT, onReady);
    });
  }

  static _resetForTests(): void {
    pending = null;
    builderIsReady = false;
  }
}
