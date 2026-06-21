import { logger } from '@/utils/logger';

export const PredictionState = {
  IDLE: 'idle',
  QUEUED: 'queued',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
} as const;

export type PredictionState = typeof PredictionState[keyof typeof PredictionState];

// Define valid transition states for the state machine
const VALID_TRANSITIONS: Record<PredictionState, PredictionState[]> = {
  [PredictionState.IDLE]: [PredictionState.QUEUED, PredictionState.PROCESSING],
  [PredictionState.QUEUED]: [PredictionState.PROCESSING, PredictionState.FAILED, PredictionState.CANCELLED],
  [PredictionState.PROCESSING]: [PredictionState.COMPLETED, PredictionState.FAILED, PredictionState.CANCELLED],
  [PredictionState.COMPLETED]: [PredictionState.QUEUED],  // Allows re-runs
  [PredictionState.FAILED]: [PredictionState.QUEUED],     // Allows retries
  [PredictionState.CANCELLED]: [PredictionState.QUEUED]   // Allows restarts
};

/**
 * Generation State Machine
 * Enforces valid state transitions and guarantees consistency of prediction lifecycles
 */
export class GenerationStateMachine {
  /**
   * Check if a transition is mathematically valid in the state diagram
   */
  public static isValidTransition(from: PredictionState, to: PredictionState): boolean {
    const allowed = VALID_TRANSITIONS[from];
    return allowed ? allowed.includes(to) : false;
  }

  /**
   * Attempts to transition to the next state, throwing an error if invalid
   */
  public static transition(from: PredictionState, to: PredictionState): PredictionState {
    if (from === to) return from;
    
    if (this.isValidTransition(from, to)) {
      logger.log(`[StateMachine] Transitioned successfully: ${from} -> ${to}`);
      return to;
    }
    
    const err = `Invalid transition: ${from} -> ${to} is not permitted.`;
    logger.error(`[StateMachine] ${err}`);
    throw new Error(err);
  }
}

export default GenerationStateMachine;
