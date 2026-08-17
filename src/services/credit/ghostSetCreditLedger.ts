/**
 * ghostSetCreditLedger.ts
 * Hold / Commit / Release Credit Ledger for Multi-Engine Ghost Sets.
 * Prevents double-charging bugs, race conditions, and stale state closures.
 */

import { AIModelEngine } from '../ai/inpaintPayloadBuilder';

export interface CreditLedgerEntry {
  id: string;
  holdId: string;
  engineId: string;
  amount: number;
  status: 'held' | 'committed' | 'released';
  ghostSetId: string;
  timestamp: number;
}

export class GhostSetCreditLedger {
  /**
   * Creates temporary hold entries for all Ghost Set candidates during generation.
   */
  public static createHoldsForGhostSet(
    engines: AIModelEngine[],
    ghostSetId: string
  ): CreditLedgerEntry[] {
    return engines.map((engine) => ({
      id: `ledg_${Math.random().toString(36).substring(2, 9)}`,
      holdId: `hold_${Math.random().toString(36).substring(2, 9)}_${engine.id.replace(/[^a-z0-9]/gi, '_')}`,
      engineId: engine.id,
      amount: engine.creditCost,
      status: 'held',
      ghostSetId,
      timestamp: Date.now(),
    }));
  }

  /**
   * Idempotency Check — Prevents double-click / double-commit race conditions.
   */
  public static isAlreadyCommitted(ledger: CreditLedgerEntry[], ghostSetId: string): boolean {
    return ledger.some((e) => e.ghostSetId === ghostSetId && e.status === 'committed');
  }

  /**
   * Atomic Commit — Commits chosen candidate hold and releases all remaining candidate holds.
   */
  public static commitSelectionSafe(
    ledger: CreditLedgerEntry[],
    ghostSetId: string,
    chosenHoldId: string
  ): { updatedLedger: CreditLedgerEntry[]; totalCharged: number } {
    if (GhostSetCreditLedger.isAlreadyCommitted(ledger, ghostSetId)) {
      throw new Error(`[CreditLedger] Ghost set ${ghostSetId} is already committed. Rejection triggered to prevent double-charging.`);
    }

    const setEntries = ledger.filter((e) => e.ghostSetId === ghostSetId);
    const chosen = setEntries.find((e) => e.holdId === chosenHoldId);

    const updatedLedger = ledger.map((entry) => {
      if (entry.ghostSetId !== ghostSetId) return entry;

      if (entry.holdId === chosenHoldId) {
        return { ...entry, status: 'committed' as const };
      }
      return { ...entry, status: 'released' as const };
    });

    return {
      updatedLedger,
      totalCharged: chosen?.amount ?? 0,
    };
  }

  /**
   * Releases all candidate holds if the Ghost Set generation is cancelled.
   */
  public static cancelGhostSet(ledger: CreditLedgerEntry[], ghostSetId: string): CreditLedgerEntry[] {
    return ledger.map((entry) =>
      entry.ghostSetId === ghostSetId && entry.status === 'held'
        ? { ...entry, status: 'released' as const }
        : entry
    );
  }

  /**
   * Derived Available Balance calculation.
   */
  public static getAvailableCredits(totalBalance: number, ledger: CreditLedgerEntry[]): number {
    const held = ledger.filter((e) => e.status === 'held').reduce((s, e) => s + e.amount, 0);
    const committed = ledger.filter((e) => e.status === 'committed').reduce((s, e) => s + e.amount, 0);
    return Math.max(0, totalBalance - held - committed);
  }
}
