import { type BaseUpscaler, type UpscaleResult, getImageDimensions } from './BaseUpscaler';
import { type AIConfig } from '../../stores/aiConfigStore';
import { replicateService } from '../replicate/ReplicateService';

export class TopazUpscaler implements BaseUpscaler {
  private modelId = 'topazlabs/image-upscale';

  validateInputs(_config: AIConfig): void {
    // Topaz inputs are validated at form level, no strict validation needed here
  }

  buildPayload(config: AIConfig, image: string): Record<string, unknown> {
    const topazFactor = config.topazUpscaleFactor ?? '2x';
    const payload: Record<string, any> = {
      image,
      upscale_factor: topazFactor,
      enhance_model: config.enhanceModel ?? 'Low Resolution V2',
      subject_detection: config.topazSubjectDetection ?? 'None',
      output_format: (config as any).topazOutputFormat ?? 'jpg',
      face_enhancement: config.faceEnhancement ?? false,
    };

    if (config.faceEnhancement) {
      payload.face_enhancement_creativity = config.faceEnhancementCreativity ?? 0;
      payload.face_enhancement_strength = config.faceEnhancementStrength ?? 0.8;
    }

    return payload;
  }

  async execute(config: AIConfig, image: string): Promise<UpscaleResult> {
    const payload = this.buildPayload(config, image);
    const prediction = await replicateService.runPrediction(this.modelId, payload);
    const imageUrl = replicateService.extractImageUrl(prediction.output);
    
    const dims = await getImageDimensions(image);
    const topazFactor = config.topazUpscaleFactor ?? '2x';
    
    let displayScale = 2;
    if (topazFactor === 'None') displayScale = 1;
    else if (topazFactor === '2x') displayScale = 2;
    else if (topazFactor === '4x') displayScale = 4;
    else if (topazFactor === '6x') displayScale = 6;

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
export default TopazUpscaler;
