import { describe, it, expect } from 'vitest';
import {
  CREDIT_PACKAGES,
  getModelCost,
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
        expect(getModelCost('black-forest-labs/flux-2-pro')).toBe(1);
        expect(getModelCost('black-forest-labs/flux-kontext-pro')).toBe(1);
      });
      
      it('should return correct cost for other models', () => {
        expect(getModelCost('bytedance/seedream-4.5')).toBe(1);
        expect(getModelCost('xai/grok-imagine-image')).toBe(1);
      });
      
      it('should return correct cost for GPT Image 2 based on quality', () => {
        expect(getModelCost('openai/gpt-image-2', { qualityVariant: 'low' })).toBe(1);
        expect(getModelCost('openai/gpt-image-2', { qualityVariant: 'medium' })).toBe(1);
        expect(getModelCost('openai/gpt-image-2', { qualityVariant: 'high' })).toBe(2);
        expect(getModelCost('openai/gpt-image-2', { qualityVariant: 'auto' })).toBe(2);
      });
      
      it('should return correct cost for Nano Banana based on resolution', () => {
        expect(getModelCost('google/nano-banana-2', { resolution: '1024x1024' })).toBe(2);
        expect(getModelCost('google/nano-banana-2', { resolution: '2048x2048' })).toBe(2);
        expect(getModelCost('google/nano-banana-2', { resolution: '4096x4096' })).toBe(3);
      });
      
      it('should return correct cost for Nano Banana Pro', () => {
        expect(getModelCost('google/nano-banana-pro', { resolution: '1024x1024' })).toBe(3);
        expect(getModelCost('google/nano-banana-pro', { resolution: '2048x2048' })).toBe(3);
        expect(getModelCost('google/nano-banana-pro', { resolution: '4096x4096' })).toBe(5);
      });
      
      it('should return default cost for unknown models', () => {
        expect(getModelCost('unknown/model')).toBe(GENERATION_COST.standard);
      });
      
      it('should return correct cost for upscale models', () => {
        expect(getModelCost('topazlabs/image-upscale')).toBe(2);
      });
    });

    describe('Paid Mode (isTrial = false)', () => {
      it('should return correct cost for FLUX models', () => {
        expect(getModelCost('black-forest-labs/flux-2-pro', { resolution: '512x512', isTrial: false })).toBe(0.5);
        expect(getModelCost('black-forest-labs/flux-2-pro', { resolution: '1024x1024', isTrial: false })).toBe(1.2);
        expect(getModelCost('black-forest-labs/flux-2-pro', { resolution: '2048x2048', isTrial: false })).toBe(1.6);
        expect(getModelCost('black-forest-labs/flux-2-pro', { resolution: '4096x4096', isTrial: false })).toBe(2.0);
        expect(getModelCost('black-forest-labs/flux-kontext-pro', { isTrial: false })).toBe(1.0);
      });
      
      it('should return correct cost for other models', () => {
        expect(getModelCost('bytedance/seedream-4.5', { resolution: '2048x2048', isTrial: false })).toBe(1.0);
        expect(getModelCost('bytedance/seedream-4.5', { resolution: '4096x4096', isTrial: false })).toBe(1.5);
        expect(getModelCost('xai/grok-imagine-image', { isTrial: false })).toBe(1.0);
      });
      
      it('should return correct cost for GPT Image 2 based on quality', () => {
        expect(getModelCost('openai/gpt-image-2', { qualityVariant: 'low', isTrial: false })).toBe(2.0);
        expect(getModelCost('openai/gpt-image-2', { qualityVariant: 'medium', isTrial: false })).toBe(2.0);
        expect(getModelCost('openai/gpt-image-2', { qualityVariant: 'high', isTrial: false })).toBe(2.0);
        expect(getModelCost('openai/gpt-image-2', { qualityVariant: 'auto', isTrial: false })).toBe(2.0);
      });
      
      it('should return correct cost for Nano Banana based on resolution', () => {
        expect(getModelCost('google/nano-banana-2', { resolution: '1024x1024', isTrial: false })).toBe(1.4);
        expect(getModelCost('google/nano-banana-2', { resolution: '2048x2048', isTrial: false })).toBe(1.5);
        expect(getModelCost('google/nano-banana-2', { resolution: '4096x4096', isTrial: false })).toBe(2.5);
      });
      
      it('should return correct cost for Nano Banana Pro', () => {
        expect(getModelCost('google/nano-banana-pro', { resolution: '1024x1024', isTrial: false })).toBe(2.2);
        expect(getModelCost('google/nano-banana-pro', { resolution: '2048x2048', isTrial: false })).toBe(2.5);
        expect(getModelCost('google/nano-banana-pro', { resolution: '4096x4096', isTrial: false })).toBe(3.5);
      });
      
      it('should return correct cost for upscale models', () => {
        // Topaz Labs Upscale
        expect(getModelCost('topazlabs/image-upscale', { upscaleFactor: 2, isTrial: false })).toBe(1.45);
        expect(getModelCost('topazlabs/image-upscale', { upscaleFactor: 4, isTrial: false })).toBe(1.45);
        expect(getModelCost('topazlabs/image-upscale', { upscaleFactor: 6, isTrial: false })).toBe(1.8);
        
        // Clarity Upscaler
        expect(getModelCost('philz1337x/clarity-upscaler', { upscaleFactor: 2, isTrial: false })).toBe(1.0);
        expect(getModelCost('philz1337x/clarity-upscaler', { upscaleFactor: 4, isTrial: false })).toBe(1.0);
        expect(getModelCost('philz1337x/clarity-upscaler', { upscaleFactor: 8, isTrial: false })).toBe(1.25);
        expect(getModelCost('philz1337x/clarity-upscaler', { upscaleFactor: 12, isTrial: false })).toBe(2.0);
        
        // P Image Upscale MP brackets
        expect(getModelCost('prunaai/p-image-upscale', { prunaTarget: 2, isTrial: false })).toBe(0.2);
        expect(getModelCost('prunaai/p-image-upscale', { prunaTarget: 6, isTrial: false })).toBe(0.4);
        expect(getModelCost('prunaai/p-image-upscale', { prunaTarget: 12, isTrial: false })).toBe(0.6);
        expect(getModelCost('prunaai/p-image-upscale', { prunaTarget: 24, isTrial: false })).toBe(0.8);
        expect(getModelCost('prunaai/p-image-upscale', { prunaTarget: 48, isTrial: false })).toBe(1.25);
        expect(getModelCost('prunaai/p-image-upscale', { prunaTarget: 96, isTrial: false })).toBe(2.5);
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
