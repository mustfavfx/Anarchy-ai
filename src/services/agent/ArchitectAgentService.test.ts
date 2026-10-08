import { describe, it, expect } from 'vitest';
import { architectAgent } from './ArchitectAgentService';

describe('ArchitectAgentService', () => {
  it('generates an architectural design response with prompt synthesis', async () => {
    const res = await architectAgent.generateResponse({
      message: 'Design a contemporary desert villa with limestone louvers and shaded courtyard.',
      mode: 'prompt',
    });

    expect(res).toBeDefined();
    expect(res.response).toBeDefined();
    expect(res.response.length).toBeGreaterThan(20);
  }, 90000);

  it('responds fluently in Arabic to autonomous architectural development queries', async () => {
    const res = await architectAgent.generateResponse({
      message: 'قم بتطوير نفسك بنفسك معماريا',
      mode: 'general',
    });

    expect(res).toBeDefined();
    expect(res.response).toBeDefined();
    expect(res.response.length).toBeGreaterThan(30);
  }, 90000);
});
