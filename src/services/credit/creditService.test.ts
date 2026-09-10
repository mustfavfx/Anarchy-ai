import { describe, it, expect } from 'vitest';
import {
  CREDIT_PACKAGES,
  getModelCost,
  getUnifiedCost,
  GENERATION_COST,
} from './creditService';

describe('Credit Service', () => {
  describe('CREDIT_PACKAGES', () => {
    it('should have correct package definitions', () => {
      expect(CREDIT_PACKAGES).toHaveLength(6);
      
      const p10 = CREDIT_PACKAGES.find(p => p.id === 'p10');
      expect(p10).toBeDefined();
      expect(p10?.amount).toBe(10);
      expect(p10?.credits).toBe(100);
      expect(p10?.bonus).toBe(5);
      
      const p100 = CREDIT_PACKAGES.find(p => p.id === 'p100');
      expect(p100).toBeDefined();
      expect(p100?.amount).toBe(100);
      expect(p100?.credits).toBe(1000);
      expect(p100?.bonus).toBe(150);
    });
    
    it('should have custom package with zero defaults', () => {
      const custom = CREDIT_PACKAGES.find(p => p.id === 'custom');
      expect(custom).toBeDefined();
      expect(custom?.amount).toBe(0);
      expect(custom?.credits).toBe(0);
    });
  });
  
  describe('getModelCost', () => {
    describe('Trial Mode (isTrial = true or default)', () => {
      it('should return correct cost for FLUX models', () => {
        expect(getModelCost('black-forest-labs/flux-2-pro')).toBe(0.5);
        expect(getModelCost('black-forest-labs/flux-kontext-pro')).toBe(1);
      });
      
      it('should return correct cost for other models', () => {
        expect(getModelCost('bytedance/seedream-4.5')).toBe(1);
        expect(getModelCost('bytedance/seedream-5-pro', { resolution: '1024x1024' })).toBe(0.8);
        expect(getModelCost('bytedance/seedream-5-pro', { resolution: '2048x2048' })).toBe(1.3);
        expect(getModelCost('prunaai/p-image')).toBe(0.5);
        expect(getModelCost('krea/krea-2-large')).toBe(1);
        expect(getModelCost('xai/grok-imagine-image')).toBe(1);
      });
      
      it('should return correct cost for GPT Image 2 based on quality', () => {
        // Passed as qualityVariant
        expect(getModelCost('openai/gpt-image-2', { qualityVariant: 'low' })).toBe(0.5);
        expect(getModelCost('openai/gpt-image-2', { qualityVariant: 'medium' })).toBe(0.8);
        expect(getModelCost('openai/gpt-image-2', { qualityVariant: 'high' })).toBe(1.8);
        expect(getModelCost('openai/gpt-image-2', { qualityVariant: 'auto' })).toBe(1.8);
        // Passed as resolution (from UI quality dropdown)
        expect(getModelCost('openai/gpt-image-2', { resolution: 'low' })).toBe(0.5);
        expect(getModelCost('openai/gpt-image-2', { resolution: 'medium' })).toBe(0.8);
        expect(getModelCost('openai/gpt-image-2', { resolution: 'high' })).toBe(1.8);
        expect(getModelCost('openai/gpt-image-2', { resolution: 'auto' })).toBe(1.8);
        // Tested via getUnifiedCost
        expect(getUnifiedCost({ model: 'openai/gpt-image-2', resolution: 'low' })).toBe(0.5);
        expect(getUnifiedCost({ model: 'openai/gpt-image-2', resolution: 'medium' })).toBe(0.8);
        expect(getUnifiedCost({ model: 'openai/gpt-image-2', resolution: 'high' })).toBe(1.8);
        expect(getUnifiedCost({ model: 'openai/gpt-image-2', resolution: 'auto' })).toBe(1.8);
      });

      it('should return correct cost for GPT Image 2.5 (Flare & Sunburst) across all 6 quality tiers', () => {
        const models = ['openai/gpt-image-2.5-flare', 'openai/gpt-image-2.5-sunburst'] as const;
        for (const model of models) {
          // Check all 6 quality levels
          expect(getModelCost(model, { qualityVariant: 'auto' })).toBe(3);
          expect(getModelCost(model, { qualityVariant: 'low' })).toBe(0.5);
          expect(getModelCost(model, { qualityVariant: 'medium' })).toBe(0.8);
          expect(getModelCost(model, { qualityVariant: 'high' })).toBe(1.8);
          expect(getModelCost(model, { qualityVariant: 'xhigh' })).toBe(3);
          expect(getModelCost(model, { qualityVariant: 'max' })).toBe(6.5);

          // Via resolution parameter
          expect(getModelCost(model, { resolution: 'auto' })).toBe(3);
          expect(getModelCost(model, { resolution: 'low' })).toBe(0.5);
          expect(getModelCost(model, { resolution: 'medium' })).toBe(0.8);
          expect(getModelCost(model, { resolution: 'high' })).toBe(1.8);
          expect(getModelCost(model, { resolution: 'xhigh' })).toBe(3);
          expect(getModelCost(model, { resolution: 'max' })).toBe(6.5);

          // Via getUnifiedCost
          expect(getUnifiedCost({ model, resolution: 'auto' })).toBe(3);
          expect(getUnifiedCost({ model, resolution: 'low' })).toBe(0.5);
          expect(getUnifiedCost({ model, resolution: 'medium' })).toBe(0.8);
          expect(getUnifiedCost({ model, resolution: 'high' })).toBe(1.8);
          expect(getUnifiedCost({ model, resolution: 'xhigh' })).toBe(3);
          expect(getUnifiedCost({ model, resolution: 'max' })).toBe(6.5);

          // Paid mode
          expect(getModelCost(model, { qualityVariant: 'low', isTrial: false })).toBe(0.5);
          expect(getModelCost(model, { qualityVariant: 'medium', isTrial: false })).toBe(0.8);
          expect(getModelCost(model, { qualityVariant: 'high', isTrial: false })).toBe(1.8);
          expect(getModelCost(model, { qualityVariant: 'xhigh', isTrial: false })).toBe(3);
          expect(getModelCost(model, { qualityVariant: 'max', isTrial: false })).toBe(6.5);
          expect(getModelCost(model, { qualityVariant: 'auto', isTrial: false })).toBe(3);
        }
      });
      
      it('should return correct cost for Nano Banana based on resolution', () => {
        expect(getModelCost('google/nano-banana-2', { resolution: '1024x1024' })).toBe(1.1);
        expect(getModelCost('google/nano-banana-2', { resolution: '2048x2048' })).toBe(1.2);
        expect(getModelCost('google/nano-banana-2', { resolution: '4096x4096' })).toBe(2.2);
      });

      it('should return correct cost for Nano Banana Lite', () => {
        expect(getModelCost('google/nano-banana-2-lite')).toBe(0.7);
      });

      it('should return correct cost for Reve Edit Fast', () => {
        expect(getModelCost('reve/edit-fast')).toBe(0.4);
      });
      
      it('should return correct cost for Nano Banana Pro', () => {
        expect(getModelCost('google/nano-banana-pro', { resolution: '1024x1024' })).toBe(2.2);
        expect(getModelCost('google/nano-banana-pro', { resolution: '2048x2048' })).toBe(2.2);
        expect(getModelCost('google/nano-banana-pro', { resolution: '4096x4096' })).toBe(4.2);
        expect(getModelCost('google/nano-banana-pro', { resolution: 'fallback' })).toBe(1.0);
        expect(getModelCost('google/nano-banana-pro')).toBe(1.0);
      });
      
      it('should return default cost for unknown models', () => {
        expect(getModelCost('unknown/model')).toBe(GENERATION_COST.standard);
      });
      
      it('should return correct cost for upscale models', () => {
        expect(getModelCost('topazlabs/image-upscale')).toBe(1);
      });
    });

    describe('Paid Mode (isTrial = false)', () => {
      it('should return correct cost for FLUX models', () => {
        expect(getModelCost('black-forest-labs/flux-2-pro', { resolution: '512x512', isTrial: false })).toBe(0.5);
        expect(getModelCost('black-forest-labs/flux-2-pro', { resolution: '1024x1024', isTrial: false })).toBe(0.5);
        expect(getModelCost('black-forest-labs/flux-2-pro', { resolution: '2048x2048', isTrial: false })).toBe(0.5);
        expect(getModelCost('black-forest-labs/flux-2-pro', { resolution: '4096x4096', isTrial: false })).toBe(0.5);
        expect(getModelCost('black-forest-labs/flux-kontext-pro', { isTrial: false })).toBe(1.0);
      });
      
      it('should return correct cost for other models', () => {
        expect(getModelCost('bytedance/seedream-4.5', { resolution: '2048x2048', isTrial: false })).toBe(1.0);
        expect(getModelCost('bytedance/seedream-4.5', { resolution: '4096x4096', isTrial: false })).toBe(1.5);
        expect(getModelCost('bytedance/seedream-4.5', { resolution: 'custom', width: 2048, height: 2048, isTrial: false })).toBe(1.0);
        expect(getModelCost('bytedance/seedream-4.5', { resolution: 'custom', width: 4096, height: 4096, isTrial: false })).toBe(1.5);
        expect(getModelCost('bytedance/seedream-5-pro', { resolution: '1024x1024', isTrial: false })).toBe(0.8);
        expect(getModelCost('bytedance/seedream-5-pro', { resolution: '2048x2048', isTrial: false })).toBe(1.3);
        expect(getModelCost('bytedance/seedream-5-pro', { resolution: '4096x4096', isTrial: false })).toBe(1.3);
        expect(getModelCost('prunaai/p-image', { isTrial: false })).toBe(0.5);
        expect(getModelCost('krea/krea-2-large', { isTrial: false })).toBe(1);
        expect(getModelCost('xai/grok-imagine-image', { isTrial: false })).toBe(1.0);
      });
      
      it('should return correct cost for GPT Image 2 based on quality', () => {
        expect(getModelCost('openai/gpt-image-2', { qualityVariant: 'low', isTrial: false })).toBe(0.5);
        expect(getModelCost('openai/gpt-image-2', { qualityVariant: 'medium', isTrial: false })).toBe(0.8);
        expect(getModelCost('openai/gpt-image-2', { qualityVariant: 'high', isTrial: false })).toBe(1.8);
        expect(getModelCost('openai/gpt-image-2', { qualityVariant: 'auto', isTrial: false })).toBe(1.8);
        // Passed as resolution (from UI quality dropdown)
        expect(getModelCost('openai/gpt-image-2', { resolution: 'low', isTrial: false })).toBe(0.5);
        expect(getModelCost('openai/gpt-image-2', { resolution: 'medium', isTrial: false })).toBe(0.8);
        expect(getModelCost('openai/gpt-image-2', { resolution: 'high', isTrial: false })).toBe(1.8);
        expect(getModelCost('openai/gpt-image-2', { resolution: 'auto', isTrial: false })).toBe(1.8);
        // Tested via getUnifiedCost
        expect(getUnifiedCost({ model: 'openai/gpt-image-2', resolution: 'low' }, false)).toBe(0.5);
        expect(getUnifiedCost({ model: 'openai/gpt-image-2', resolution: 'medium' }, false)).toBe(0.8);
        expect(getUnifiedCost({ model: 'openai/gpt-image-2', resolution: 'high' }, false)).toBe(1.8);
        expect(getUnifiedCost({ model: 'openai/gpt-image-2', resolution: 'auto' }, false)).toBe(1.8);
      });
      
      it('should return correct cost for Nano Banana based on resolution', () => {
        expect(getModelCost('google/nano-banana-2', { resolution: '1024x1024', isTrial: false })).toBe(1.1);
        expect(getModelCost('google/nano-banana-2', { resolution: '2048x2048', isTrial: false })).toBe(1.2);
        expect(getModelCost('google/nano-banana-2', { resolution: '4096x4096', isTrial: false })).toBe(2.2);
      });

      it('should return correct cost for Nano Banana Lite', () => {
        expect(getModelCost('google/nano-banana-2-lite', { isTrial: false })).toBe(0.7);
      });
      
      it('should return correct cost for Nano Banana Pro', () => {
        expect(getModelCost('google/nano-banana-pro', { resolution: '1024x1024', isTrial: false })).toBe(2.2);
        expect(getModelCost('google/nano-banana-pro', { resolution: '2048x2048', isTrial: false })).toBe(2.2);
        expect(getModelCost('google/nano-banana-pro', { resolution: '4096x4096', isTrial: false })).toBe(4.2);
        expect(getModelCost('google/nano-banana-pro', { resolution: 'fallback', isTrial: false })).toBe(1.0);
        expect(getModelCost('google/nano-banana-pro', { isTrial: false })).toBe(1.0);
      });
      
      it('should return correct cost for upscale models', () => {
        // Topaz Labs Upscale (dynamic Megapixels aligned with Replicate official tiers)
        // Default base image (1024x1024 = 1 MP):
        // 2x upscale -> 4.19 MP (<= 24 MP) -> 1 credit
        expect(getModelCost('topazlabs/image-upscale', { upscaleFactor: 2, isTrial: false })).toBe(1);
        // 4x upscale -> 16.78 MP (<= 24 MP) -> 1 credit
        expect(getModelCost('topazlabs/image-upscale', { upscaleFactor: 4, isTrial: false })).toBe(1);
        // 6x upscale -> 37.75 MP (<= 48 MP) -> 2 credits
        expect(getModelCost('topazlabs/image-upscale', { upscaleFactor: 6, isTrial: false })).toBe(2);

        // High resolution / 4K input image (3840x2160 ≈ 8.29 MP):
        // 4K + 2x -> 33.18 MP (<= 48 MP) -> 2 credits
        expect(getModelCost('topazlabs/image-upscale', { upscaleFactor: 2, width: 3840, height: 2160, isTrial: false })).toBe(2);
        // 4K + 4x -> 132.7 MP (<= 168 MP) -> 6 credits
        expect(getModelCost('topazlabs/image-upscale', { upscaleFactor: 4, width: 3840, height: 2160, isTrial: false })).toBe(6);
        // 4K + 6x -> 298.6 MP (<= 336 MP) -> 11 credits
        expect(getModelCost('topazlabs/image-upscale', { upscaleFactor: 6, width: 3840, height: 2160, isTrial: false })).toBe(11);

        // Explicit Output Megapixels brackets (Replicate official table):
        expect(getModelCost('topazlabs/image-upscale', { outputMegapixels: 12 })).toBe(1);
        expect(getModelCost('topazlabs/image-upscale', { outputMegapixels: 24 })).toBe(1);
        expect(getModelCost('topazlabs/image-upscale', { outputMegapixels: 36 })).toBe(2);
        expect(getModelCost('topazlabs/image-upscale', { outputMegapixels: 48 })).toBe(2);
        expect(getModelCost('topazlabs/image-upscale', { outputMegapixels: 60 })).toBe(3);
        expect(getModelCost('topazlabs/image-upscale', { outputMegapixels: 96 })).toBe(4);
        expect(getModelCost('topazlabs/image-upscale', { outputMegapixels: 132 })).toBe(5);
        expect(getModelCost('topazlabs/image-upscale', { outputMegapixels: 168 })).toBe(6);
        expect(getModelCost('topazlabs/image-upscale', { outputMegapixels: 336 })).toBe(11);
        expect(getModelCost('topazlabs/image-upscale', { outputMegapixels: 512 })).toBe(17);
        
        // Clarity Upscaler (A100 GPU compute based: 2x=3, 4x=10, 8x=20, 12x=30)
        expect(getModelCost('philz1337x/clarity-upscaler', { upscaleFactor: 2, isTrial: false })).toBe(3);
        expect(getModelCost('philz1337x/clarity-upscaler', { upscaleFactor: 4, isTrial: false })).toBe(10);
        expect(getModelCost('philz1337x/clarity-upscaler', { upscaleFactor: 8, isTrial: false })).toBe(20);
        expect(getModelCost('philz1337x/clarity-upscaler', { upscaleFactor: 12, isTrial: false })).toBe(30);
        
        // P Image Upscale MP brackets
        expect(getModelCost('prunaai/p-image-upscale', { prunaTarget: 2, isTrial: false })).toBe(0.2);
        expect(getModelCost('prunaai/p-image-upscale', { prunaTarget: 6, isTrial: false })).toBe(0.4);
        expect(getModelCost('prunaai/p-image-upscale', { prunaTarget: 12, isTrial: false })).toBe(0.6);
        expect(getModelCost('prunaai/p-image-upscale', { prunaTarget: 24, isTrial: false })).toBe(0.8);
        expect(getModelCost('prunaai/p-image-upscale', { prunaTarget: 48, isTrial: false })).toBe(1.25);
        expect(getModelCost('prunaai/p-image-upscale', { prunaTarget: 96, isTrial: false })).toBe(2.5);
        
        // P Image Upscale Factor Mode (1024x1024 = 1MP base)
        expect(getModelCost('prunaai/p-image-upscale', { prunaMode: 'factor', prunaFactor: 2, isTrial: false })).toBe(0.4); // 4.19 MP -> 4-8 MP tier = 0.4
        expect(getModelCost('prunaai/p-image-upscale', { prunaMode: 'factor', prunaFactor: 4, isTrial: false })).toBe(0.8); // 16.7 MP -> 16-32 MP tier = 0.8
        expect(getModelCost('prunaai/p-image-upscale', { prunaMode: 'factor', prunaFactor: 8, isTrial: false })).toBe(2.5); // 67.1 MP -> 64-128 MP tier = 2.5
        
        // P Image Upscale Trial Mode
        expect(getModelCost('prunaai/p-image-upscale', { prunaTarget: 16, isTrial: true })).toBe(1);
        expect(getModelCost('prunaai/p-image-upscale', { prunaTarget: 64, isTrial: true })).toBe(2);
        expect(getModelCost('prunaai/p-image-upscale', { prunaTarget: 128, isTrial: true })).toBe(3);

        // Anarchy Upscale (Clarity Pro: philz1337x/clarity-pro-upscaler)
        // $0.03/MP capped at 64 MP -> credits = Math.max(2, Math.ceil(mp * 0.6))
        expect(getModelCost('philz1337x/clarity-pro-upscaler', { upscaleFactor: 2, isTrial: false })).toBe(3);
        expect(getModelCost('philz1337x/clarity-pro-upscaler', { upscaleFactor: 4, isTrial: false })).toBe(11);
        expect(getModelCost('philz1337x/clarity-pro-upscaler', { upscaleFactor: 8, isTrial: false })).toBe(39);
        expect(getModelCost('philz1337x/clarity-pro-upscaler', { upscaleFactor: 16, isTrial: false })).toBe(39);

        // Kling v3 Omni Video (standard=3.0, pro=5.0, 4k=12.0)
        expect(getModelCost('kwaivgi/kling-v3-omni-video', { resolution: 'standard', videoDuration: '5s' })).toBe(15.0);
        expect(getModelCost('kwaivgi/kling-v3-omni-video', { resolution: 'pro', videoDuration: '5s' })).toBe(25.0);
        expect(getModelCost('kwaivgi/kling-v3-omni-video', { resolution: '4k', videoDuration: '5s' })).toBe(60.0);
        expect(getModelCost('kwaivgi/kling-v3-omni-video', { resolution: 'pro', videoDuration: '10s' })).toBe(50.0);

        // Grok Imagine Video 1.5 (1.2 credits per second)
        expect(getModelCost('xai/grok-imagine-video-1.5', { videoDuration: '5s' })).toBe(6.0);
        expect(getModelCost('xai/grok-imagine-video-1.5', { videoDuration: '10s' })).toBe(12.0);

        // Google Veo 3.1 Fast (5.5 credits per second)
        expect(getModelCost('google/veo-3.1-fast', { videoDuration: '4s' })).toBe(22.0);
        expect(getModelCost('google/veo-3.1-fast', { videoDuration: '8s' })).toBe(44.0);

        // Pruna AI Video (720p = 2.5, 1080p = 6.0 credits per second)
        expect(getModelCost('prunaai/p-video', { resolution: '720p', videoDuration: '5s' })).toBe(12.5);
        expect(getModelCost('prunaai/p-video', { resolution: '1080p', videoDuration: '5s' })).toBe(30.0);

        // PixVerse v6 (360p=1.0, 540p=1.8, 720p=3.5, 1080p=8.0 credits per second)
        expect(getModelCost('pixverse/pixverse-v6', { resolution: '360p', videoDuration: '5s' })).toBe(5.0);
        expect(getModelCost('pixverse/pixverse-v6', { resolution: '540p', videoDuration: '5s' })).toBe(9.0);
        expect(getModelCost('pixverse/pixverse-v6', { resolution: '720p', videoDuration: '5s' })).toBe(17.5);
        expect(getModelCost('pixverse/pixverse-v6', { resolution: '1080p', videoDuration: '5s' })).toBe(40.0);

        // OpenAI Sora 2 Pro (standard=6.0, high=12.0 credits per second)
        expect(getModelCost('openai/sora-2-pro', { resolution: 'standard', videoDuration: '4s' })).toBe(24.0);
        expect(getModelCost('openai/sora-2-pro', { resolution: 'high', videoDuration: '4s' })).toBe(48.0);
      });
    });
  });
  
  describe('Cost constants', () => {
    it('should have reasonable default costs', () => {
      expect(GENERATION_COST.standard).toBeGreaterThan(0);
      expect(GENERATION_COST.hd).toBeGreaterThanOrEqual(GENERATION_COST.standard);
      expect(GENERATION_COST['4k']).toBeGreaterThanOrEqual(GENERATION_COST.hd);
    });
    
    it('should have video costs proportional to quality', () => {
      expect(GENERATION_COST.video720).toBeGreaterThan(GENERATION_COST.video480);
    });
  });
});
