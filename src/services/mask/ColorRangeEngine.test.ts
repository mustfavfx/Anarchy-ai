import { describe, it, expect } from 'vitest';
import { ColorRangeEngine } from './ColorRangeEngine';

describe('ColorRangeEngine', () => {
  function createGradientImageData(width = 10, height = 10): ImageData {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const val = Math.round((x / (width - 1)) * 255); // 0 to 255 gradient
        data[idx] = val;
        data[idx + 1] = val;
        data[idx + 2] = val;
        data[idx + 3] = 255;
      }
    }
    return { width, height, data, colorSpace: 'srgb' } as ImageData;
  }

  it('calculates ITU-R BT.601 perceptual luminance correctly', () => {
    // Pure White: 255
    expect(ColorRangeEngine.calculateLuminance(255, 255, 255)).toBe(255);
    // Pure Black: 0
    expect(ColorRangeEngine.calculateLuminance(0, 0, 0)).toBe(0);
    // Pure Green vs Pure Blue (Green has much higher perceptual weight)
    const greenLuma = ColorRangeEngine.calculateLuminance(0, 255, 0);
    const blueLuma = ColorRangeEngine.calculateLuminance(0, 0, 255);
    expect(greenLuma).toBeGreaterThan(blueLuma);
  });

  it('isolates highlights (>192) in luminance mask', () => {
    const imgData = createGradientImageData(10, 10);
    const mask = ColorRangeEngine.generateLumaMask(imgData, {
      type: 'highlights',
      lowThreshold: 192,
      highThreshold: 255,
      feather: 0,
    });

    // Leftmost pixels (x=0, val=0) should have alpha 0
    expect(mask[0]).toBe(0);
    // Rightmost pixels (x=9, val=255) should have alpha 255
    expect(mask[9]).toBe(255);
  });

  it('isolates shadows (<64) in luminance mask', () => {
    const imgData = createGradientImageData(10, 10);
    const mask = ColorRangeEngine.generateLumaMask(imgData, {
      type: 'shadows',
      lowThreshold: 0,
      highThreshold: 64,
      feather: 0,
    });

    // Leftmost pixels (x=0, val=0) should have alpha 255
    expect(mask[0]).toBe(255);
    // Rightmost pixels (x=9, val=255) should have alpha 0
    expect(mask[9]).toBe(0);
  });

  it('isolates sampled color range within tolerance', () => {
    const imgData = createGradientImageData(10, 10);
    const mask = ColorRangeEngine.generateColorRangeMask(imgData, {
      targetR: 255,
      targetG: 255,
      targetB: 255,
      tolerance: 10,
      feather: 0,
    });

    // Pixel close to white (x=9, val=255) should be selected
    expect(mask[9]).toBe(255);
    // Pixel far from white (x=0, val=0) should be unselected
    expect(mask[0]).toBe(0);
  });

  it('applies feathering blur on mask edges', () => {
    const width = 10;
    const height = 10;
    const mask = new Uint8Array(width * height);
    // Fill top half with 255, bottom half with 0
    for (let i = 0; i < width * 5; i++) {
      mask[i] = 255;
    }

    const feathered = ColorRangeEngine.applyFeather(mask, width, height, 2);
    expect(feathered.length).toBe(mask.length);
    // Boundary pixel at row 4 or 5 should have intermediate alpha
    const boundaryAlpha = feathered[5 * width + 5];
    expect(boundaryAlpha).toBeGreaterThan(0);
    expect(boundaryAlpha).toBeLessThan(255);
  });
});
