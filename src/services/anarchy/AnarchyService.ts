export type {
  AnarchyModel,
  AnarchyModelMeta,
  AnarchyGenerationParams,
  AnarchyGenerationResult,
  AnarchyPrediction,
} from './modules/anarchyTypes';

import type {
  AnarchyModelMeta,
  AnarchyGenerationParams,
  AnarchyGenerationResult,
  AnarchyPrediction,
} from './modules/anarchyTypes';

export {
  getModelCapabilities,
  getModelSettings,
} from './modules/anarchyCapabilities';

import {
  getModelCapabilities,
  getModelSettings,
} from './modules/anarchyCapabilities';

export {
  resolveImageToPngBase64,
} from './modules/anarchyImageResolver';

import {
  resolveImageToPngBase64,
} from './modules/anarchyImageResolver';

export {
  getApiKey,
  throttleReveApiCall,
  runRevePrediction,
} from './modules/reveTransport';

import {
  getApiKey,
  throttleReveApiCall,
  runRevePrediction,
} from './modules/reveTransport';

export {
  layoutCache,
  getCacheKey,
  clearLayoutCache,
  sanitizeLayoutForApi,
  extractLayout,
  renderLayout,
  visualizeLayout,
  visualizeEmptyLayout,
  createLayout,
  reconcileLayouts,
} from './modules/reveLayoutEngine';

import {
  layoutCache,
  getCacheKey,
  clearLayoutCache,
  sanitizeLayoutForApi,
  extractLayout,
  renderLayout,
  visualizeLayout,
  visualizeEmptyLayout,
  createLayout,
  reconcileLayouts,
} from './modules/reveLayoutEngine';

export class AnarchyService {
  public layoutCache = layoutCache;

  public getApiKey(): string {
    return getApiKey();
  }

  public async throttleReveApiCall(): Promise<void> {
    return throttleReveApiCall();
  }

  public clearLayoutCache(imageKey?: string): void {
    return clearLayoutCache(imageKey);
  }

  public getModelCapabilities(model: string): AnarchyModelMeta {
    return getModelCapabilities(model);
  }

  public getModelSettings(model: string) {
    return getModelSettings(model);
  }

  public async resolveImageToPngBase64(src: string): Promise<string> {
    return resolveImageToPngBase64(src);
  }

  public async runRevePrediction(
    input: Record<string, any>,
    signal?: AbortSignal,
    onStatusChange?: (status: 'queued' | 'processing', predictionId?: string) => void
  ): Promise<AnarchyPrediction> {
    return runRevePrediction(input, signal, onStatusChange);
  }

  public getCacheKey(image: string, prompt?: string): string {
    return getCacheKey(image, prompt);
  }

  public async extractLayout(
    image: string,
    prompt?: string,
    signal?: AbortSignal,
    forceRefresh: boolean = false
  ): Promise<any> {
    return extractLayout(image, prompt, signal, forceRefresh);
  }

  public sanitizeLayoutForApi(rawLayout: any, bboxFormat: 'array' | 'object' = 'array'): any {
    return sanitizeLayoutForApi(rawLayout, bboxFormat);
  }

  public async renderLayout(
    layout: any,
    images: string[],
    signal?: AbortSignal
  ): Promise<AnarchyGenerationResult> {
    return renderLayout(layout, images, signal);
  }

  public async visualizeLayout(imageUrl: string, layout: any): Promise<string> {
    return visualizeLayout(imageUrl, layout);
  }

  public async visualizeEmptyLayout(layout: any): Promise<string> {
    return visualizeEmptyLayout(layout);
  }

  public async createLayout(prompt: string, signal?: AbortSignal): Promise<any> {
    return createLayout(prompt, signal);
  }

  public async reconcileLayouts(layouts: any[], signal?: AbortSignal): Promise<any> {
    return reconcileLayouts(layouts, signal);
  }

  public async generate(
    params: AnarchyGenerationParams,
    images: string[],
    signal?: AbortSignal,
    onStatusChange?: (status: 'queued' | 'processing', predictionId?: string) => void
  ): Promise<AnarchyGenerationResult> {
    const start = Date.now();
    
    // Check if model is extract-layout
    if (params.model === 'reve/extract-layout') {
      if (images.length === 0) {
        throw new Error('Reve Extract Layout requires a reference image.');
      }
      const layout = await this.extractLayout(images[0], params.prompt, signal);
      const imageUrl = await this.visualizeLayout(images[0], layout);
      return {
        id: `reve-layout-${Date.now()}`,
        imageUrl,
        imageUrls: [imageUrl],
        metadata: {
          model: params.model,
          prompt: params.prompt || 'Extract Layout',
          width: 1024,
          height: 1024,
          seed: -1,
          steps: 1,
          generationTime: Date.now() - start,
          timestamp: Date.now(),
          layout, // Include raw layout in metadata for easy JSON copy
        },
      };
    }

    // Check if model is create-layout
    if (params.model === 'reve/create-layout') {
      const layout = await this.createLayout(params.prompt || '', signal);
      const imageUrl = await this.visualizeEmptyLayout(layout);
      return {
        id: `reve-create-layout-${Date.now()}`,
        imageUrl,
        imageUrls: [imageUrl],
        metadata: {
          model: params.model,
          prompt: params.prompt || 'Create Layout',
          width: layout.width || 1024,
          height: layout.height || 1024,
          seed: -1,
          steps: 1,
          generationTime: Date.now() - start,
          timestamp: Date.now(),
          layout, // Send raw layout back
        },
      };
    }

    // Check if model is reconcile-layouts
    if (params.model === 'reve/reconcile-layouts') {
      let layoutsObj: any[] = [];
      try {
        layoutsObj = JSON.parse(params.prompt);
        if (!Array.isArray(layoutsObj)) {
          layoutsObj = [layoutsObj];
        }
      } catch {
        throw new Error('Reve Reconcile Layouts requires a valid JSON Array of layouts in the prompt field.');
      }
      const layout = await this.reconcileLayouts(layoutsObj, signal);
      const imageUrl = await this.visualizeEmptyLayout(layout);
      return {
        id: `reve-reconcile-layouts-${Date.now()}`,
        imageUrl,
        imageUrls: [imageUrl],
        metadata: {
          model: params.model,
          prompt: params.prompt || 'Reconcile Layouts',
          width: layout.width || 1024,
          height: layout.height || 1024,
          seed: -1,
          steps: 1,
          generationTime: Date.now() - start,
          timestamp: Date.now(),
          layout,
        },
      };
    }

    // Check if model is render-layout
    if (params.model === 'reve/render-layout') {
      let layoutObj: any = null;
      try {
        layoutObj = JSON.parse(params.prompt);
      } catch {
        throw new Error('Reve Render Layout requires a valid JSON layout structure in the prompt field.');
      }
      return this.renderLayout(layoutObj, images, signal);
    }

    // Resolve all images to PNG base64 (Reve only accepts specific formats)
    const references = await Promise.all(
      images.map(async (img) => {
        const base64Data = await this.resolveImageToPngBase64(img);
        return { data: base64Data };
      })
    );

    let finalPrompt = params.prompt || '';
    if (references.length > 0 && !finalPrompt.includes('<frame>')) {
      finalPrompt = `<frame>0</frame> ${finalPrompt}`;
    }

    // Map postprocessing parameters
    const postprocessing: any[] = [];
    if (params.anarchyRemoveBackground) {
      postprocessing.push({ process: 'remove_background' });
    }
    if (params.anarchyUpscaleFactor && params.anarchyUpscaleFactor !== 'Off') {
      const factor = parseInt(params.anarchyUpscaleFactor.replace('x', ''), 10);
      if (!isNaN(factor)) {
        postprocessing.push({ process: 'upscale', upscale_factor: factor });
      }
    }
    if (params.anarchyEffect && params.anarchyEffect !== 'None') {
      postprocessing.push({ process: 'effect', effect_name: params.anarchyEffect });
    }

    const input: Record<string, any> = {
      prompt: finalPrompt,
      aspect_ratio: params.aspectRatio === 'match_input_image' ? 'auto' : (params.aspectRatio || 'auto'),
      references,
      postprocessing
    };

    // If a mask image is passed (2nd reference image), attach mask explicitly for Reve inpainting
    if (references.length > 1) {
      input.mask = references[1];
    }

    const prediction = await this.runRevePrediction(input, signal, onStatusChange);
    const imageUrl = prediction.output || '';

    return {
      id: prediction.id,
      imageUrl,
      imageUrls: [imageUrl],
      metadata: {
        model: params.model,
        prompt: params.prompt,
        width: 1024,
        height: 1024,
        seed: -1,
        steps: 1,
        generationTime: Date.now() - start,
        timestamp: Date.now(),
      },
    };
  }
}

export const anarchyService = new AnarchyService();
export default AnarchyService;
