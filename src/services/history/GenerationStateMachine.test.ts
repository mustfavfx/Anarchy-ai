import { describe, it, expect } from 'vitest';
import { GenerationStateMachine, PredictionState } from './GenerationStateMachine';

describe('GenerationStateMachine', () => {
  it('validates correct state transitions', () => {
    // idle -> queued / processing
    expect(GenerationStateMachine.isValidTransition(PredictionState.IDLE, PredictionState.QUEUED)).toBe(true);
    expect(GenerationStateMachine.isValidTransition(PredictionState.IDLE, PredictionState.PROCESSING)).toBe(true);
    
    // queued -> processing / failed / cancelled
    expect(GenerationStateMachine.isValidTransition(PredictionState.QUEUED, PredictionState.PROCESSING)).toBe(true);
    expect(GenerationStateMachine.isValidTransition(PredictionState.QUEUED, PredictionState.FAILED)).toBe(true);
    expect(GenerationStateMachine.isValidTransition(PredictionState.QUEUED, PredictionState.CANCELLED)).toBe(true);

    // processing -> completed / failed / cancelled
    expect(GenerationStateMachine.isValidTransition(PredictionState.PROCESSING, PredictionState.COMPLETED)).toBe(true);
    expect(GenerationStateMachine.isValidTransition(PredictionState.PROCESSING, PredictionState.FAILED)).toBe(true);
    expect(GenerationStateMachine.isValidTransition(PredictionState.PROCESSING, PredictionState.CANCELLED)).toBe(true);
  });

  it('rejects invalid transitions', () => {
    // idle -> completed (impossible without processing)
    expect(GenerationStateMachine.isValidTransition(PredictionState.IDLE, PredictionState.COMPLETED)).toBe(false);

    // completed -> processing (must go to queued first)
    expect(GenerationStateMachine.isValidTransition(PredictionState.COMPLETED, PredictionState.PROCESSING)).toBe(false);
  });

  it('performs transition and returns next state if valid', () => {
    const result = GenerationStateMachine.transition(PredictionState.IDLE, PredictionState.QUEUED);
    expect(result).toBe(PredictionState.QUEUED);
  });

  it('throws error on invalid transition attempts', () => {
    expect(() => {
      GenerationStateMachine.transition(PredictionState.IDLE, PredictionState.COMPLETED);
    }).toThrow(/Invalid transition/);
  });
});
