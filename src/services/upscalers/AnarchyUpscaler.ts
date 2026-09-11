import { type BaseUpscaler, type UpscaleResult, getImageDimensions } from './BaseUpscaler';
import { type AIConfig } from '../../stores/aiConfigStore';
import { replicateService } from '../replicate/ReplicateService';

export class AnarchyUpscaler implements BaseUpscaler {
  private modelId = 'philz1337x/clarity-pro-upscaler';

  validateInputs(_config: AIConfig): void {
    // Inputs are validated at form level
  }

  buildPayload(config: AIConfig, image: string): Record<string, unknown> {
    const scaleFactor = (config as any).anarchyUpscaleScale ?? config.upscaleFactor ?? 2;
    const creativity = (config as any).anarchyUpscaleCreativity ?? 4;

    return {
      image,
      scale_factor: Number(scaleFactor),
      creativity: Number(creativity),
      output_format: 'png',
    };
  }

  async execute(
    config: AIConfig,
    image: string,
    signal?: AbortSignal,
    onStatusChange?: (status: 'queued' | 'processing') => void
  ): Promise<UpscaleResult> {
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
    const prediction = await replicateService.runPrediction(
      this.modelId,
      payload,
      config.nodeId,
      config.userId,
      signal,
      onStatusChange
    );
    const imageUrl = replicateService.extractImageUrl(prediction.output);
    const dims = await getImageDimensions(image);
    const scale = (config as any).anarchyUpscaleScale ?? config.upscaleFactor ?? 2;

    return {
      imageUrl,
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
export default AnarchyUpscaler;
