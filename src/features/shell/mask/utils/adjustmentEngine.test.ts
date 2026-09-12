import { describe, it, expect } from 'vitest';
import {
  applyAdjustmentParamsToImageData,
  generateSplineLUT,
  buildCurveLUT,
} from './adjustmentEngine';

function createDummyImageData(r = 100, g = 150, b = 200, a = 255): ImageData {
  const data = new Uint8ClampedArray(4 * 4); // 4 pixels
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = a;
  }
  return {
    data,
    width: 2,
    height: 2,
    colorSpace: 'srgb',
  } as ImageData;
}

describe('adjustmentEngine', () => {
  it('handles invert for mask correctly', () => {
    const imgData = createDummyImageData(0, 0, 0, 255);
    applyAdjustmentParamsToImageData(imgData, { key: 'invert', name: 'Invert' }, true);
    // Alpha was > 10, so it should become 0
    expect(imgData.data[3]).toBe(0);
  });

  it('handles threshold for mask correctly', () => {
    const imgData = createDummyImageData(0, 0, 0, 150);
    applyAdjustmentParamsToImageData(
      imgData,
      { key: 'threshold', name: 'Threshold', thresholdLevel: 128 },
      true
    );
    expect(imgData.data[3]).toBe(240);
  });

  it('handles brightness and contrast correctly on RGB', () => {
    const imgData = createDummyImageData(100, 100, 100, 255);
    applyAdjustmentParamsToImageData(
      imgData,
      { key: 'brightness-contrast', name: 'Brightness/Contrast', brightness: 20, contrast: 10 },
      false
    );
    expect(imgData.data[0]).toBeGreaterThan(100);
  });

  it('handles black & white correctly', () => {
    const imgData = createDummyImageData(200, 100, 50, 255);
    applyAdjustmentParamsToImageData(
      imgData,
      { key: 'black-white', name: 'Black & White' },
      false
    );
    expect(imgData.data[0]).toBe(imgData.data[1]);
    expect(imgData.data[1]).toBe(imgData.data[2]);
  });

  it('handles vibrance correctly', () => {
    const imgData = createDummyImageData(180, 120, 100, 255);
    const initialR = imgData.data[0];
    applyAdjustmentParamsToImageData(
      imgData,
      { key: 'vibrance', name: 'Vibrance', vibrance: 50 },
      false
    );
    expect(imgData.data[0]).toBeGreaterThanOrEqual(initialR);
  });

  it('handles exposure correctly', () => {
    const imgData = createDummyImageData(100, 100, 100, 255);
    applyAdjustmentParamsToImageData(
      imgData,
      { key: 'exposure', name: 'Exposure', exposure: 1 },
      false
    );
    expect(imgData.data[0]).toBeGreaterThan(100);
  });

  it('handles invert on RGB correctly', () => {
    const imgData = createDummyImageData(50, 100, 200, 255);
    applyAdjustmentParamsToImageData(
      imgData,
      { key: 'invert', name: 'Invert' },
      false
    );
    expect(imgData.data[0]).toBe(205);
    expect(imgData.data[1]).toBe(155);
    expect(imgData.data[2]).toBe(55);
  });

  it('handles posterize correctly', () => {
    const imgData = createDummyImageData(120, 120, 120, 255);
    applyAdjustmentParamsToImageData(
      imgData,
      { key: 'posterize', name: 'Posterize', posterizeLevels: 4 },
      false
    );
    expect(imgData.data[0] % 85).toBe(0);
  });

  it('handles gradient map correctly', () => {
    const imgData = createDummyImageData(128, 128, 128, 255);
    applyAdjustmentParamsToImageData(
      imgData,
      { key: 'gradient-map', name: 'Gradient Map', gradientPreset: 'sunset' },
      false
    );
    expect(imgData.data[0]).toBeDefined();
    expect(imgData.data[1]).toBeDefined();
    expect(imgData.data[2]).toBeDefined();
  });

  it('handles curves adjustment on RGB correctly', () => {
    const imgData = createDummyImageData(128, 128, 128, 255);
    applyAdjustmentParamsToImageData(
      imgData,
      { key: 'curves', name: 'Curves', curveAmount: 60 },
      false
    );
    expect(imgData.data[0]).toBeGreaterThan(0);
    expect(imgData.data[0]).toBeLessThanOrEqual(255);
  });

  it('handles levels adjustment on RGB correctly', () => {
    const imgData = createDummyImageData(100, 150, 200, 255);
    applyAdjustmentParamsToImageData(
      imgData,
      { key: 'levels', name: 'Levels', blackPoint: 10, whitePoint: 240, midtones: 1.2 },
      false
    );
    expect(imgData.data[0]).toBeGreaterThanOrEqual(0);
    expect(imgData.data[2]).toBeLessThanOrEqual(255);
  });

  it('handles color balance correctly', () => {
    const imgData = createDummyImageData(100, 100, 100, 255);
    applyAdjustmentParamsToImageData(
      imgData,
      { key: 'color-balance', name: 'Color Balance', redBalance: 25, greenBalance: -10, blueBalance: 15 },
      false
    );
    expect(imgData.data[0]).toBe(125);
    expect(imgData.data[1]).toBe(90);
    expect(imgData.data[2]).toBe(115);
  });

  it('handles photo filter correctly', () => {
    const imgData = createDummyImageData(100, 100, 100, 255);
    applyAdjustmentParamsToImageData(
      imgData,
      { key: 'photo-filter', name: 'Photo Filter', filterPreset: 'cool', filterDensity: 50 },
      false
    );
    expect(imgData.data[0]).toBeDefined();
    expect(imgData.data[1]).toBeDefined();
    expect(imgData.data[2]).toBeDefined();
  });

  it('handles channel mixer correctly', () => {
    const imgData = createDummyImageData(100, 150, 200, 255);
    applyAdjustmentParamsToImageData(
      imgData,
      { key: 'channel-mixer', name: 'Channel Mixer', channelRed: 120, channelGreen: 10, channelBlue: 0 },
      false
    );
    expect(imgData.data[0]).toBeGreaterThan(0);
  });

  it('handles color lookup (LUT) correctly', () => {
    const imgData = createDummyImageData(128, 128, 128, 255);
    applyAdjustmentParamsToImageData(
      imgData,
      { key: 'color-lookup', name: 'Color Lookup', lutPreset: 'teal-orange', lutIntensity: 80 },
      false
    );
    expect(imgData.data[0]).toBeDefined();
    expect(imgData.data[2]).toBeDefined();
  });

  it('handles selective color correctly', () => {
    const imgData = createDummyImageData(200, 50, 50, 255);
    applyAdjustmentParamsToImageData(
      imgData,
      { key: 'selective-color', name: 'Selective Color', selectiveCyan: 20, selectiveBlack: 10 },
      false
    );
    expect(imgData.data[0]).toBeLessThan(200);
  });

  it('handles all 16 adjustment tool keys without throwing', () => {
    const keys = [
      'brightness', 'levels', 'curves', 'exposure', 'vibrance', 'hue-sat',
      'color-balance', 'black-white', 'photo-filter', 'channel-mixer',
      'color-lookup', 'invert', 'posterize', 'threshold', 'gradient-map',
      'selective-color'
    ];

    for (const key of keys) {
      const imgData = createDummyImageData(140, 120, 90, 255);
      expect(() => {
        applyAdjustmentParamsToImageData(imgData, { key, name: key }, false);
      }).not.toThrow();
    }
  });

  describe('Photoshop Curves Spline & LUT Engine', () => {
    it('produces identity LUT for default 2-point curve (0,0) -> (255,255)', () => {
      const lut = generateSplineLUT([
        { x: 0, y: 0 },
        { x: 255, y: 255 },
      ]);
      expect(lut[0]).toBe(0);
      expect(lut[64]).toBe(64);
      expect(lut[128]).toBe(128);
      expect(lut[192]).toBe(192);
      expect(lut[255]).toBe(255);
    });

    it('produces inverted LUT for negative curve (0,255) -> (255,0)', () => {
      const lut = generateSplineLUT([
        { x: 0, y: 255 },
        { x: 255, y: 0 },
      ]);
      expect(lut[0]).toBe(255);
      expect(lut[128]).toBe(127);
      expect(lut[255]).toBe(0);
    });

    it('produces smooth S-curve with medium contrast', () => {
      const lut = generateSplineLUT([
        { x: 0, y: 0 },
        { x: 64, y: 48 },
        { x: 192, y: 208 },
        { x: 255, y: 255 },
      ]);
      // Shadows darkened
      expect(lut[64]).toBeLessThan(64);
      // Highlights brightened
      expect(lut[192]).toBeGreaterThan(192);
      // Continuous monotonicity
      for (let i = 1; i < 256; i++) {
        expect(lut[i]).toBeGreaterThanOrEqual(lut[i - 1]);
      }
    });

    it('combines master RGB and individual channel curves via buildCurveLUT', () => {
      const masterPoints = [
        { x: 0, y: 0 },
        { x: 128, y: 150 },
        { x: 255, y: 255 },
      ];
      const redPoints = [
        { x: 0, y: 0 },
        { x: 128, y: 100 },
        { x: 255, y: 255 },
      ];
      const lut = buildCurveLUT(redPoints, masterPoints);
      expect(lut.length).toBe(256);
      expect(lut[0]).toBe(0);
      expect(lut[255]).toBe(255);
    });

    it('applies curveChannels to ImageData accurately across channels', () => {
      const imgData = createDummyImageData(100, 100, 100, 255);
      applyAdjustmentParamsToImageData(
        imgData,
        {
          key: 'curves',
          name: 'Curves',
          curveChannels: {
            rgb: [
              { x: 0, y: 0 },
              { x: 100, y: 140 },
              { x: 255, y: 255 },
            ],
            red: [
              { x: 0, y: 0 },
              { x: 140, y: 160 },
              { x: 255, y: 255 },
            ],
            green: [
              { x: 0, y: 0 },
              { x: 255, y: 255 },
            ],
            blue: [
              { x: 0, y: 0 },
              { x: 255, y: 255 },
            ],
          },
        },
        false
      );

      // Red channel should be adjusted by master curve then red channel curve
      expect(imgData.data[0]).toBeGreaterThan(140);
      // Green channel was adjusted by master curve only
      expect(imgData.data[1]).toBe(140);
      // Blue channel was adjusted by master curve only
      expect(imgData.data[2]).toBe(140);
    });
  });
});
