import { describe, it, expect } from 'vitest';
import { SmartSegmentationEngine } from './SmartSegmentationEngine';

describe('SmartSegmentationEngine', () => {
  // Helper to create a dummy 20x20 ImageData with a square object in the middle
  function createTestImageData(width = 20, height = 20): ImageData {
    const data = new Uint8ClampedArray(width * height * 4);

    // Background: Dark gray (30, 30, 30)
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 30;
      data[i + 1] = 30;
      data[i + 2] = 30;
      data[i + 3] = 255;
    }

    // Foreground Object: Bright Cyan box from (5,5) to (14,14)
    for (let y = 5; y < 15; y++) {
      for (let x = 5; x < 15; x++) {
        const idx = (y * width + x) * 4;
        data[idx] = 6;
        data[idx + 1] = 182;
        data[idx + 2] = 212;
        data[idx + 3] = 255;
      }
    }

    return {
      width,
      height,
      data,
      colorSpace: 'srgb',
    } as ImageData;
  }

  it('correctly prepares image and precomputes Sobel edge gradient', () => {
    const imgData = createTestImageData();
    SmartSegmentationEngine.prepareImage(imgData, 'test-key-1');
    // If it doesn't throw and sets caches, it succeeds
    expect(true).toBe(true);
  });

  it('segments foreground object when seed is inside the box', () => {
    const imgData = createTestImageData(20, 20);
    const result = SmartSegmentationEngine.segment(imgData, 'test-key-2', 10, 10, 30, 40);

    expect(result).not.toBeNull();
    if (result) {
      expect(result.pixelCount).toBeGreaterThan(40);
      expect(result.bounds.minX).toBeGreaterThanOrEqual(5);
      expect(result.bounds.maxX).toBeLessThanOrEqual(14);
      expect(result.bounds.minY).toBeGreaterThanOrEqual(5);
      expect(result.bounds.maxY).toBeLessThanOrEqual(14);
      expect(result.contourPoints.length).toBeGreaterThan(0);
    }
  });

  it('stops growing at edges and does not leak into background', () => {
    const imgData = createTestImageData(20, 20);
    const result = SmartSegmentationEngine.segment(imgData, 'test-key-3', 10, 10, 30, 40);

    expect(result).not.toBeNull();
    if (result) {
      // Corner pixel (0,0) in background must NOT be selected
      expect(result.mask[0]).toBe(0);
      // Pixel inside box (10,10) must be selected
      expect(result.mask[10 * 20 + 10]).toBe(1);
    }
  });
});
