import { describe, it, expect } from 'vitest';
import { autoPromptService, detectLanguage } from './autoPromptService';

describe('AutoPromptService', () => {
  describe('detectLanguage', () => {
    it('detects Arabic text accurately', () => {
      expect(detectLanguage('فيلا مودرن على البحر')).toBe('ar');
      expect(detectLanguage('تصميم داخلي صالون فخم مع إضاءة دافئة')).toBe('ar');
      expect(detectLanguage('واجهات زجاجية ومسبح انفينيتي')).toBe('ar');
    });

    it('detects English text accurately', () => {
      expect(detectLanguage('modern luxury villa by the ocean')).toBe('en');
      expect(detectLanguage('futuristic skyscraper with glass facade')).toBe('en');
      expect(detectLanguage('12345')).toBe('en');
    });
  });

  describe('enhancePrompt offline fallback', () => {
    it('enhances Arabic prompt into professional Arabic architectural visual prompt', async () => {
      const raw = 'فيلا مودرن على البحر فيها مسبح';
      const res = await autoPromptService.enhancePrompt(raw);

      expect(res.originalPrompt).toBe(raw);
      expect(res.detectedLanguage).toBe('ar');
      expect(res.enhancedPrompt).toContain(raw);
      // Contains rich Arabic architectural keywords
      expect(res.enhancedPrompt).toMatch(/معماري|مسبح|ساحل|تصوير فوتوغرافي/);
    });

    it('enhances English prompt into professional English architectural visual prompt', async () => {
      const raw = 'modern villa with concrete and timber';
      const res = await autoPromptService.enhancePrompt(raw);

      expect(res.originalPrompt).toBe(raw);
      expect(res.detectedLanguage).toBe('en');
      expect(res.enhancedPrompt.toLowerCase()).toMatch(/concrete|timber|villa|photography/i);
    });

    it('adds seamless Arabic inpainting cues when mode is inpaint with Arabic prompt', async () => {
      const raw = 'طاولة رخام';
      const res = await autoPromptService.enhancePrompt(raw, { mode: 'inpaint' });

      expect(res.detectedLanguage).toBe('ar');
      expect(res.enhancedPrompt).toContain('دمج سلس');
      expect(res.enhancedPrompt).toContain('إضاءة محيطية');
    });

    it('adds seamless English inpainting cues when mode is inpaint with English prompt', async () => {
      const raw = 'marble kitchen island';
      const res = await autoPromptService.enhancePrompt(raw, { mode: 'inpaint' });

      expect(res.detectedLanguage).toBe('en');
      expect(res.enhancedPrompt.toLowerCase()).toContain('seamless');
      expect(res.enhancedPrompt.toLowerCase()).toContain('ambient lighting');
    });

    it('handles empty prompt gracefully', async () => {
      const res = await autoPromptService.enhancePrompt('');
      expect(res.enhancedPrompt).toBe('');
      expect(res.originalPrompt).toBe('');
    });
  });
});
