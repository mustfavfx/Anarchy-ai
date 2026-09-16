import { describe, it, expect } from 'vitest';
import {
  getClosestGptAspectRatio,
  buildGptImageInput,
  buildResult
} from './modules/replicatePayloadBuilders';
import { MODEL_META } from './modules/replicateConstants';

describe('GPT Image 2 & 2.5 Dimension & Aspect Ratio Preservation', () => {
  describe('MODEL_META configuration', () => {
    it('includes match_input_image as the primary aspect ratio for GPT Image models', () => {
      const gpt2 = MODEL_META['openai/gpt-image-2'];
      const flare = MODEL_META['openai/gpt-image-2.5-flare'];
      const sunburst = MODEL_META['openai/gpt-image-2.5-sunburst'];

      expect(gpt2.aspectRatios).toContain('match_input_image');
      expect(gpt2.aspectRatios[0]).toBe('match_input_image');

      expect(flare.aspectRatios).toContain('match_input_image');
      expect(flare.aspectRatios[0]).toBe('match_input_image');

      expect(sunburst.aspectRatios).toContain('match_input_image');
      expect(sunburst.aspectRatios[0]).toBe('match_input_image');
    });
  });

  describe('getClosestGptAspectRatio', () => {
    it('maps 16:9 images correctly', () => {
      expect(getClosestGptAspectRatio(1920, 1080)).toBe('16:9');
      expect(getClosestGptAspectRatio(1280, 720)).toBe('16:9');
      expect(getClosestGptAspectRatio(3840, 2160)).toBe('16:9');
    });

    it('maps 9:16 portrait images correctly', () => {
      expect(getClosestGptAspectRatio(1080, 1920)).toBe('9:16');
      expect(getClosestGptAspectRatio(720, 1280)).toBe('9:16');
      expect(getClosestGptAspectRatio(2160, 3840)).toBe('9:16');
    });

    it('maps 3:2 and 2:3 images correctly', () => {
      expect(getClosestGptAspectRatio(1500, 1000)).toBe('3:2');
      expect(getClosestGptAspectRatio(1000, 1500)).toBe('2:3');
    });

    it('maps 4:3 and 3:4 images correctly', () => {
      expect(getClosestGptAspectRatio(1024, 768)).toBe('4:3');
      expect(getClosestGptAspectRatio(800, 600)).toBe('4:3');
      expect(getClosestGptAspectRatio(768, 1024)).toBe('3:4');
      expect(getClosestGptAspectRatio(600, 800)).toBe('3:4');
    });

    it('maps square images correctly', () => {
      expect(getClosestGptAspectRatio(1000, 1000)).toBe('1:1');
      expect(getClosestGptAspectRatio(512, 512)).toBe('1:1');
    });

    it('handles fallback for missing or zero dimensions', () => {
      expect(getClosestGptAspectRatio(0, 0)).toBe('1:1');
      expect(getClosestGptAspectRatio(1000, 0)).toBe('1:1');
    });
  });

  describe('buildGptImageInput', () => {
    it('automatically uses closest aspect ratio when input image is present and ratio is match_input_image', () => {
      const input = buildGptImageInput(
        {
          model: 'openai/gpt-image-2',
          prompt: 'edit this image',
          aspectRatio: 'match_input_image',
          sourceWidth: 1920,
          sourceHeight: 1080,
        },
        ['https://example.com/photo.png']
      );

      expect(input.aspect_ratio).toBe('16:9');
      expect(input.input_images).toEqual(['https://example.com/photo.png']);
    });

    it('automatically adapts when input image is present even if default aspectRatio is 1:1', () => {
      const input = buildGptImageInput(
        {
          model: 'openai/gpt-image-2.5-flare',
          prompt: 'render modern style',
          aspectRatio: '1:1',
          sourceWidth: 1200,
          sourceHeight: 800,
        },
        ['https://example.com/photo.png']
      );

      // 1200 / 800 = 1.5 -> 3:2
      expect(input.aspect_ratio).toBe('3:2');
    });

    it('adapts portrait images to 9:16', () => {
      const input = buildGptImageInput(
        {
          model: 'openai/gpt-image-2.5-sunburst',
          prompt: 'vertical portrait edit',
          aspectRatio: 'match_input_image',
          sourceWidth: 1080,
          sourceHeight: 1920,
        },
        ['https://example.com/portrait.png']
      );

      expect(input.aspect_ratio).toBe('9:16');
    });

    it('falls back to 1:1 for text-to-image when match_input_image is requested without images', () => {
      const input = buildGptImageInput(
        {
          model: 'openai/gpt-image-2',
          prompt: 'a beautiful landscape',
          aspectRatio: 'match_input_image',
        },
        []
      );

      expect(input.aspect_ratio).toBe('1:1');
      expect(input.input_images).toBeUndefined();
    });
  });

  describe('buildResult', () => {
    it('preserves source dimensions in metadata for GPT Image models', () => {
      const result = buildResult(
        {
          model: 'openai/gpt-image-2',
          prompt: 'test prompt',
          aspectRatio: 'match_input_image',
          sourceWidth: 1920,
          sourceHeight: 1080,
        },
        'https://example.com/result.png',
        {},
        Date.now()
      );

      expect(result.metadata.width).toBe(1920);
      expect(result.metadata.height).toBe(1080);
    });

    it('preserves source dimensions for GPT 2.5 Flare', () => {
      const result = buildResult(
        {
          model: 'openai/gpt-image-2.5-flare',
          prompt: 'test prompt',
          sourceWidth: 1280,
          sourceHeight: 720,
        },
        'https://example.com/result.png',
        {},
        Date.now()
      );

      expect(result.metadata.width).toBe(1280);
      expect(result.metadata.height).toBe(720);
    });
  });
});
