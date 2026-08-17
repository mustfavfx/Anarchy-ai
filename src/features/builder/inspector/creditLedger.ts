/**
 * creditLedger.ts
 * Hold-then-commit credit accounting for ghost sets. Fixes the root cause of
 * the multi-ghost-node credit bug: nothing is charged until the user
 * actually picks a result, and picking is idempotent.
 *
 * Integration point: wire `getAvailableCredits` into useBuilderCredits so the
 * displayed balance is always derived from this ledger, never a separately
 * mutated counter.
 */

import type { AIModelEngine, CreditLedgerEntry } from './types';

export function createHoldsForGhostSet(
  engines: AIModelEngine[],
  ghostSetId: string
): CreditLedgerEntry[] {
  return engines.map((engine) => ({
    id: crypto.randomUUID(),
    holdId: crypto.randomUUID(),
    engineId: engine.id,
    amount: engine.creditCost,
    status: 'held' as const,
    ghostSetId,
    timestamp: Date.now(),
  }));
}

export function hasEnoughCredits(totalBalance: number, ledger: CreditLedgerEntry[], engines: AIModelEngine[]): boolean {
  const pending = engines.reduce((sum, e) => sum + e.creditCost, 0);
  return getAvailableCredits(totalBalance, ledger) >= pending;
}

export function isAlreadyCommitted(ledger: CreditLedgerEntry[], ghostSetId: string): boolean {
  return ledger.some((e) => e.ghostSetId === ghostSetId && e.status === 'committed');
}

/** Charges exactly the chosen entry; releases every other hold in the same ghost set. Rejects a second commit. */
export function commitSelection(
  ledger: CreditLedgerEntry[],
  ghostSetId: string,
  chosenHoldId: string
): { updatedLedger: CreditLedgerEntry[]; totalCharged: number } {
  if (isAlreadyCommitted(ledger, ghostSetId)) {
    throw new Error(`Ghost set ${ghostSetId} already committed`);
  }

  const setEntries = ledger.filter((e) => e.ghostSetId === ghostSetId);
  const chosen = setEntries.find((e) => e.holdId === chosenHoldId);
  if (!chosen) throw new Error(`Hold ${chosenHoldId} not found in ghost set ${ghostSetId}`);

  const updatedLedger = ledger.map((entry) => {
    if (entry.ghostSetId !== ghostSetId) return entry;
    return entry.holdId === chosenHoldId
      ? { ...entry, status: 'committed' as const }
      : { ...entry, status: 'released' as const };
  });

  return { updatedLedger, totalCharged: chosen.amount };
}

export function cancelGhostSet(ledger: CreditLedgerEntry[], ghostSetId: string): CreditLedgerEntry[] {
  return ledger.map((entry) =>
    entry.ghostSetId === ghostSetId && entry.status === 'held'
      ? { ...entry, status: 'released' as const }
      : entry
  );
}

/** Releases holds for engines whose generation call failed — call this right after Promise.allSettled resolves. */
export function releaseFailedHolds(ledger: CreditLedgerEntry[], failedHoldIds: string[]): CreditLedgerEntry[] {
  return ledger.map((entry) =>
    failedHoldIds.includes(entry.holdId) && entry.status === 'held'
      ? { ...entry, status: 'released' as const }
      : entry
  );
}

export function getAvailableCredits(totalBalance: number, ledger: CreditLedgerEntry[]): number {
  const held = ledger.filter((e) => e.status === 'held').reduce((s, e) => s + e.amount, 0);
  const committed = ledger.filter((e) => e.status === 'committed').reduce((s, e) => s + e.amount, 0);
  return totalBalance - held - committed;
}
