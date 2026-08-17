/**
 * useGhostGeneration.ts
 * Orchestrates parallel multi-engine generation for a single selection:
 * reserve credits -> run with a concurrency cap -> settle results ->
 * release failed holds. Selection/commit is handled separately in the
 * panel (see NodeInspectorPanel.tsx) once the user picks a result.
 */

import { useCallback, useState } from 'react';
import type { AIModelEngine, CreditLedgerEntry, GhostResult } from './types';
import { createHoldsForGhostSet, hasEnoughCredits, releaseFailedHolds } from './creditLedger';

async function runWithConcurrencyLimit<T>(tasks: (() => Promise<T>)[], limit = 3): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += limit) {
    const batch = tasks.slice(i, i + limit);
    results.push(...(await Promise.all(batch.map((t) => t()))));
  }
  return results;
}

interface UseGhostGenerationArgs {
  totalBalance: number;
  ledger: CreditLedgerEntry[];
  setLedger: (updater: (prev: CreditLedgerEntry[]) => CreditLedgerEntry[]) => void;
  callEngine: (engine: AIModelEngine, payload: Record<string, unknown>) => Promise<{ url: string }>;
}

export function useGhostGeneration({ totalBalance, ledger, setLedger, callEngine }: UseGhostGenerationArgs) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<GhostResult[]>([]);
  const [ghostSetId, setGhostSetId] = useState<string | null>(null);

  const generate = useCallback(
    async (engines: AIModelEngine[], buildPayload: (engine: AIModelEngine) => Promise<Record<string, unknown>> | Record<string, unknown>) => {
      if (!hasEnoughCredits(totalBalance, ledger, engines)) {
        throw new Error('Insufficient credits for this ghost set');
      }

      const setId = crypto.randomUUID();
      const holds = createHoldsForGhostSet(engines, setId);
      setLedger((prev) => [...prev, ...holds]);
      setGhostSetId(setId);
      setIsGenerating(true);
      setResults([]);

      const tasks = engines.map((engine, i) => async (): Promise<GhostResult> => {
        const hold = holds[i];
        try {
          const result = await callEngine(engine, await buildPayload(engine));
          return { engineId: engine.id, holdId: hold.holdId, status: 'success', imageUrl: result.url };
        } catch (err) {
          return { engineId: engine.id, holdId: hold.holdId, status: 'failed', error: String(err) };
        }
      });

      const settled = await runWithConcurrencyLimit(tasks, 3);
      const failedHoldIds = settled.filter((r) => r.status === 'failed').map((r) => r.holdId);
      setLedger((prev) => releaseFailedHolds(prev, failedHoldIds));

      setResults(settled);
      setIsGenerating(false);
      return { ghostSetId: setId, results: settled };
    },
    [totalBalance, ledger, setLedger, callEngine]
  );

  return { generate, isGenerating, results, ghostSetId };
}
