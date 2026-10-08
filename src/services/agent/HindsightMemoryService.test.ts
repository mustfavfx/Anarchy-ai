import { describe, it, expect, beforeEach } from 'vitest';
import { hindsightMemory } from './HindsightMemoryService';

describe('HindsightMemoryService', () => {
  beforeEach(() => {
    hindsightMemory.clearMemory();
  });

  it('retains new architectural preferences and recalls them accurately', async () => {
    await hindsightMemory.retain({
      category: 'architectural_preference',
      content: 'Always specify Roman Navona Travertine with 15mm negative shadow gaps on residential villas.',
      tags: ['travertine', 'villa', 'shadow_gap'],
      importance: 5,
    });

    await hindsightMemory.retain({
      category: 'spatial_rule',
      content: 'Ensure 3-meter minimum municipal setback on front street facing facades.',
      tags: ['setback', 'regulations'],
      importance: 4,
    });

    const results = await hindsightMemory.recall('travertine villa', { limit: 2 });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].content).toContain('Travertine');
    expect(results[0].category).toBe('architectural_preference');
  });

  it('synthesizes high-level agent beliefs via the reflect primitive', async () => {
    await hindsightMemory.retain({
      category: 'architectural_preference',
      content: 'Use honed vein-cut travertine and raw architectural concrete.',
      tags: ['materials'],
      context: { style: 'Modern Brutalist Villa' },
      importance: 5,
    });

    await hindsightMemory.retain({
      category: 'spatial_rule',
      content: 'Provide entrance vestibule for visual privacy before reception.',
      tags: ['zoning', 'privacy'],
      importance: 4,
    });

    const reflection = await hindsightMemory.reflect(true);
    expect(reflection.beliefs.length).toBeGreaterThan(0);
    expect(reflection.preferredMaterials.some(m => /travertine|concrete/i.test(m))).toBe(true);
    expect(reflection.spatialConstraints.length).toBeGreaterThan(0);
  });

  it('generates a formatted context block for the agent system prompt', async () => {
    await hindsightMemory.retain({
      category: 'architectural_preference',
      content: 'Never use harsh cool lighting; mandate 2700K - 3000K warm hospitality ambiance.',
      tags: ['lighting', 'ambiance'],
      importance: 5,
    });

    const block = await hindsightMemory.getAgentMemoryContextBlock('lighting');
    expect(block).toContain('Hindsight');
    expect(block).toContain('lighting');
  });
});
