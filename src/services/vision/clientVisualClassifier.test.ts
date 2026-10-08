import { describe, it, expect } from 'vitest';
import { inspectImagePixels } from './clientVisualClassifier';

describe('clientVisualClassifier', () => {
  it('safely handles invalid sources and returns building fallback', async () => {
    const result = await inspectImagePixels('mock-invalid-src');
    expect(result.category).toBe('building');
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
  });
});
