import { create } from 'zustand';

export interface ExecutionJob {
  nodeId: string;
  state: 'idle' | 'connecting' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress?: number;
  outputUrl?: string;
  errorMessage?: string;
  predictionId?: string;
}

// ── O(N+E) Dependency Resolver ────────────────────────────────────────────────
/**
 * Resolves the topological execution order AND groups nodes into parallel
 * execution waves using pre-built O(1) lookup maps.
 *
 * Complexity: O(N + E) — maps are built once outside the recursion,
 * each node and each edge is visited at most once.
 *
 * Wave semantics:
 *   Wave 0 = nodes with no upstream ghost dependencies (run first, in parallel)
 *   Wave 1 = nodes whose only dependencies are at wave 0 (run after wave 0, in parallel)
 *   …
 *
 * Example:
 *   A → B → D
 *   C → D
 *   executionWaves = [[A, C], [B], [D]]
 */
function buildExecutionWaves(
  targetId: string,
  nodeMap: Map<string, any>,
  parentMap: Map<string, string[]>  // edge.target → [edge.source, ...]
): string[][] {
  const levelMap = new Map<string, number>(); // nodeId → execution level (wave index)
  const visited = new Set<string>();           // cycle guard

  /**
   * DFS that computes the execution level of each eligible ghost node.
   * Returns the level assigned, or -1 if the node is ineligible.
   */
  function dfs(nodeId: string): number {
    if (levelMap.has(nodeId)) return levelMap.get(nodeId)!;
    if (visited.has(nodeId)) return -1; // cycle detected — skip
    visited.add(nodeId);

    const parentIds = parentMap.get(nodeId) ?? [];
    let maxParentLevel = -1;

    for (const parentId of parentIds) {
      const parent = nodeMap.get(parentId);
      if (parent?.data?.type === 'ghost') {
        const parentLevel = dfs(parentId);
        if (parentLevel > maxParentLevel) maxParentLevel = parentLevel;
      }
    }

    const node = nodeMap.get(nodeId);
    const isEligible =
      node != null &&
      node.data?.type === 'ghost' &&
      node.data?.state !== 'ready' &&
      node.data?.state !== 'completed';

    const level = isEligible ? maxParentLevel + 1 : -1;
    levelMap.set(nodeId, level);
    return level;
  }

  dfs(targetId);

  // Group eligible nodes by level into waves
  const waveMap = new Map<number, string[]>();
  levelMap.forEach((level, nodeId) => {
    if (level < 0) return;
    const wave = waveMap.get(level) ?? [];
    wave.push(nodeId);
    waveMap.set(level, wave);
  });

  // Emit waves sorted by level index
  const maxLevel = waveMap.size > 0 ? Math.max(...waveMap.keys()) : -1;
  const waves: string[][] = [];
  for (let i = 0; i <= maxLevel; i++) {
    const wave = waveMap.get(i);
    if (wave && wave.length > 0) waves.push(wave);
  }
  return waves;
}

interface BuilderQueueState {
  jobs: Record<string, ExecutionJob>;
  /** Flat topological order — used for status display and legacy compat. */
  activeQueue: string[];
  /**
   * Execution waves — each inner array is a group of node IDs that can run
   * in parallel. Waves are processed sequentially (wave 0, then wave 1, …).
   */
  executionWaves: string[][];
  isExecuting: boolean;
  addJob: (nodeId: string, initialJob: Partial<ExecutionJob>) => void;
  updateJob: (nodeId: string, updates: Partial<ExecutionJob>) => void;
  removeJob: (nodeId: string) => void;
  clearQueue: () => void;
  setQueue: (queue: string[]) => void;
  setIsExecuting: (executing: boolean) => void;
  resolveAndQueue: (nodeId: string, nodes: any[], edges: any[]) => string[];
  runQueue: (executeSingle: (nodeId: string) => Promise<any>) => Promise<void>;
}

export const useBuilderQueueStore = create<BuilderQueueState>((set, get) => ({
  jobs: {},
  activeQueue: [],
  executionWaves: [],
  isExecuting: false,

  addJob: (nodeId, initialJob) =>
    set((state) => ({
      jobs: {
        ...state.jobs,
        [nodeId]: { nodeId, state: 'idle', ...initialJob }
      }
    })),

  updateJob: (nodeId, updates) =>
    set((state) => ({
      jobs: {
        ...state.jobs,
        [nodeId]: {
          ...(state.jobs[nodeId] ?? { nodeId, state: 'idle' }),
          ...updates
        }
      }
    })),

  removeJob: (nodeId) =>
    set((state) => {
      const nextJobs = { ...state.jobs };
      delete nextJobs[nodeId];
      return { jobs: nextJobs };
    }),

  clearQueue: () =>
    set({ jobs: {}, activeQueue: [], executionWaves: [], isExecuting: false }),

  setQueue: (queue) => set({ activeQueue: queue }),

  setIsExecuting: (executing) => set({ isExecuting: executing }),

  resolveAndQueue: (nodeId, nodes, edges) => {
    // ── Build lookup maps ONCE — O(N) + O(E) ───────────────────────────────
    const nodeMap = new Map<string, any>(nodes.map((n) => [n.id, n]));
    const parentMap = new Map<string, string[]>();
    for (const e of edges) {
      const parents = parentMap.get(e.target) ?? [];
      parents.push(e.source);
      parentMap.set(e.target, parents);
    }

    const newWaves = buildExecutionWaves(nodeId, nodeMap, parentMap);
    const newOrder = newWaves.flat();

    set((state) => {
      const existingIds = new Set(state.activeQueue);

      // Merge new order into flat queue (deduplicate)
      const mergedQueue = [
        ...state.activeQueue,
        ...newOrder.filter((id) => !existingIds.has(id))
      ];

      // Merge new waves — drop nodes already in the queue
      const mergedWaves = [
        ...state.executionWaves,
        ...newWaves
          .map((wave) => wave.filter((id) => !existingIds.has(id)))
          .filter((w) => w.length > 0)
      ];

      return { activeQueue: mergedQueue, executionWaves: mergedWaves };
    });

    return newOrder;
  },

  runQueue: async (executeSingle) => {
    if (get().isExecuting) return;
    set({ isExecuting: true });

    try {
      // ── Wave-based parallel execution ─────────────────────────────────────
      if (get().executionWaves.length > 0) {
        while (get().executionWaves.length > 0) {
          const wave = get().executionWaves[0];

          // Mark all nodes in this wave as connecting simultaneously
          wave.forEach((nodeId) => {
            const job = get().jobs[nodeId];
            if (!job || job.state === 'idle') {
              get().updateJob(nodeId, { state: 'connecting' });
            }
          });

          // Run the entire wave in parallel; collect results without short-circuiting
          const results = await Promise.allSettled(
            wave.map((nodeId) => executeSingle(nodeId))
          );

          // Dequeue all nodes that completed successfully
          const succeededIds = new Set(
            wave.filter((_, i) => results[i].status === 'fulfilled')
          );
          set((state) => ({
            activeQueue: state.activeQueue.filter((id) => !succeededIds.has(id)),
            executionWaves: state.executionWaves.slice(1) // advance to next wave
          }));

          // Abort the remaining waves on first failure
          const failedResult = results.find((r) => r.status === 'rejected');
          if (failedResult) {
            set({ activeQueue: [], executionWaves: [], isExecuting: false });
            throw (failedResult as PromiseRejectedResult).reason;
          }
        }
        return;
      }

      // ── Serial fallback (legacy / backward compat) ────────────────────────
      while (get().activeQueue.length > 0) {
        const nextNodeId = get().activeQueue[0];
        const job = get().jobs[nextNodeId];
        if (!job || job.state === 'idle') {
          get().updateJob(nextNodeId, { state: 'connecting' });
        }
        try {
          await executeSingle(nextNodeId);
          set((state) => ({
            activeQueue: state.activeQueue.filter((id) => id !== nextNodeId)
          }));
        } catch (err) {
          set({ activeQueue: [], executionWaves: [], isExecuting: false });
          throw err;
        }
      }
    } finally {
      set({ isExecuting: false });
    }
  }
}));
