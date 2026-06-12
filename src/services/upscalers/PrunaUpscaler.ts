import { type BaseUpscaler, type UpscaleResult, getImageDimensions } from './BaseUpscaler';
import { type AIConfig } from '../../stores/aiConfigStore';
import { replicateService } from '../replicate/ReplicateService';

export class PrunaUpscaler implements BaseUpscaler {
  private modelId = 'prunaai/p-image-upscale';

  validateInputs(_config: AIConfig): void {
    // Inputs are validated at form level
  }

  buildPayload(config: AIConfig, image: string): Record<string, unknown> {
    const payload: Record<string, any> = {
      image,
      upscale_mode: config.prunaMode ?? 'target',
      enhance_details: config.prunaEnhanceDetails ?? false,
      enhance_realism: config.prunaEnhanceRealism ?? true,
      output_format: config.prunaOutputFormat ?? 'png',
      output_quality: config.prunaQuality ?? 80,
    };

    if (config.prunaMode === 'factor') {
      payload.factor = config.prunaFactor ?? 2;
    } else {
      payload.target = config.prunaTarget ?? 4;
    }

    return payload;
  }

  async execute(config: AIConfig, image: string): Promise<UpscaleResult> {
    const payload = this.buildPayload(config, image);
    const prediction = await replicateService.runPrediction(this.modelId, payload);
    const imageUrl = replicateService.extractImageUrl(prediction.output);

    const dims = await getImageDimensions(image);
    
    let displayScale = 4;
    if (config.prunaMode === 'factor') {
      displayScale = config.prunaFactor ?? 2;
    } else {
      displayScale = config.prunaTarget ?? 4;
    }

    return {
      imageUrl,
      width: dims.width * displayScale,
      height: dims.height * displayScale,
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
export default PrunaUpscaler;
