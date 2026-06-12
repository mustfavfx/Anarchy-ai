import { type BaseUpscaler, type UpscaleResult, getImageDimensions } from './BaseUpscaler';
import { type AIConfig } from '../../stores/aiConfigStore';
import { replicateService } from '../replicate/ReplicateService';

export class ClarityUpscaler implements BaseUpscaler {
  private modelId = 'philz1337x/clarity-upscaler';

  validateInputs(_config: AIConfig): void {
    // Inputs are validated at form level
  }

  buildPayload(config: AIConfig, image: string): Record<string, unknown> {
    const seed = (config.claritySeed !== null && config.claritySeed !== undefined) 
      ? config.claritySeed 
      : Math.floor(Math.random() * 1000000);
      
    return {
      image,
      prompt: (config as any).prompt || 'masterpiece, best quality, highres, <lora:more_details:0.5> <lora:SDXLrender_v2.0:1>',
      negative_prompt: config.negativePrompt || '(worst quality, low quality, normal quality:2) JuggernautNegative-neg',
      scale_factor: config.clarityScale ?? 2,
      dynamic: config.clarityDynamic ?? 6,
      creativity: config.clarityCreativity ?? 0.35,
      resemblance: config.clarityResemblance ?? 0.6,
      tiling_width: config.clarityTilingWidth ?? 112,
      tiling_height: config.clarityTilingHeight ?? 144,
      sd_model: config.claritySdModel ?? 'juggernaut_reborn.safetensors [338b85bc4f]',
      scheduler: config.clarityScheduler ?? 'DPM++ 3M SDE Karras',
      num_inference_steps: config.claritySteps ?? 18,
      seed,
      downscaling: config.clarityDownscaling ?? false,
      downscaling_resolution: config.clarityDownscalingRes ?? 768,
      sharpen: config.claritySharpen ?? 0,
      handfix: config.clarityHandfix ?? 'disabled',
      output_format: config.clarityOutputFormat ?? 'png',
    };
  }

  async execute(config: AIConfig, image: string): Promise<UpscaleResult> {
    let currentImageUrl = image;
    
    // Resolve IDB images if passed as local cache keys
    if (currentImageUrl.startsWith('idb://')) {
      try {
        const { getLocalImage } = await import('../history/HistoryService');
        const cached = await getLocalImage(currentImageUrl);
        if (cached) {
          currentImageUrl = cached;
        }
      } catch {
        // Fall back to original url
      }
    }

    const payload = this.buildPayload(config, currentImageUrl);
    const prediction = await replicateService.runPrediction(this.modelId, payload);
    const resultImageUrl = replicateService.extractImageUrl(prediction.output);

    const dims = await getImageDimensions(image);
    const scale = config.clarityScale ?? 2;

    return {
      imageUrl: resultImageUrl,
      width: dims.width * scale,
      height: dims.height * scale,
      model: this.modelId,
    };
  }

  parseResult(response: any): UpscaleResult {
    const imageUrl = replicateService.extractImageUrl(response?.output);
    return {
      imageUrl,
      model: this.modelId,
    };
  }
}
export default ClarityUpscaler;
