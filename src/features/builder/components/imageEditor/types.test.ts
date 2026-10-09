import { describe, it, expect } from 'vitest';
import { getEngineRatioOptions, getEngineDisplayName, ALL_RATIO_OPTIONS } from './types';

describe('ImageEditorToolbar Engine-Aware Ratio Options', () => {
  it('returns specific aspect ratios supported by Nano Banana 2', () => {
    const ratios = getEngineRatioOptions('google/nano-banana-2');
    expect(ratios.length).toBeGreaterThan(0);
    expect(ratios.some((r) => r.ratio === '16:9')).toBe(true);
    expect(ratios.some((r) => r.ratio === '1:1')).toBe(true);
    expect(ratios.some((r) => r.ratio === '9:16')).toBe(true);
  });

  it('returns friendly engine display names', () => {
    expect(getEngineDisplayName('google/nano-banana-2')).toBe('Nano Banana 2');
    expect(getEngineDisplayName('black-forest-labs/flux-3-image')).toBe('FLUX 3 Image');
    expect(getEngineDisplayName('bytedance/seedream-5-pro')).toBe('Seedream 5 Pro');
  });

  it('provides complete wireframes and resolution hints for standard ratios', () => {
    const square = ALL_RATIO_OPTIONS['1:1'];
    expect(square.wireframeClass).toBe('wf-square');
    expect(square.resolutionHint).toBe('1024 × 1024');

    const widescreen = ALL_RATIO_OPTIONS['16:9'];
    expect(widescreen.wireframeClass).toBe('wf-widescreen');
    expect(widescreen.resolutionHint).toBe('1344 × 768');
  });
});
