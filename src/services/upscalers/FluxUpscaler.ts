import { type BaseUpscaler, type UpscaleResult } from './BaseUpscaler';
import { type AIConfig } from '../../stores/aiConfigStore';

export class FluxUpscaler implements BaseUpscaler {
  validateInputs(_config: AIConfig): void {
    throw new Error('Flux is not a dedicated upscaler model');
  }

  buildPayload(_config: AIConfig, _image: string): Record<string, unknown> {
    throw new Error('Flux is not a dedicated upscaler model');
  }

  async execute(_config: AIConfig, _image: string, _signal?: AbortSignal): Promise<UpscaleResult> {
    throw new Error('Flux is not a dedicated upscaler model');
  }

  parseResult(_response: unknown): UpscaleResult {
    throw new Error('Flux is not a dedicated upscaler model');
  }
}
export default FluxUpscaler;
