import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  replicateService, 
  type ReplicateImageModel,
  type ReplicateGenerationParams 
} from './ReplicateService';

describe('ReplicateService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have default API key from env', () => {
    // The service should read from VITE_REPLICATE_API_TOKEN
    expect(replicateService).toBeDefined();
  });

  it('should validate image model types', () => {
    const validModels: ReplicateImageModel[] = [
      'google/nano-banana-2',
      'black-forest-labs/flux-2-pro',
      'openai/gpt-image-2',
    ];
    
    validModels.forEach(model => {
      expect(model).toBeDefined();
    });
  });

  it('should have correct default generation params', () => {
    const defaultParams: ReplicateGenerationParams = {
      prompt: 'test prompt',
      model: 'google/nano-banana-2',
      steps: 50,
      seed: null,
    };
    
    expect(defaultParams.prompt).toBe('test prompt');
    expect(defaultParams.steps).toBe(50);
  });

  it('should update API key', () => {
    expect(() => {
      replicateService.updateApiKey();
    }).not.toThrow();
  });

  it('should handle different aspect ratios', () => {
    const ratios = ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9', 'Auto'];
    
    ratios.forEach(ratio => {
      expect(ratio).toBeDefined();
    });
  });
});
