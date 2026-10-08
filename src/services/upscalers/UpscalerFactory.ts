import { type BaseUpscaler } from './BaseUpscaler';
import { FastUpscaler } from './FastUpscaler';
import { TopazUpscaler } from './TopazUpscaler';
import { ClarityUpscaler } from './ClarityUpscaler';
import { PrunaUpscaler } from './PrunaUpscaler';
import { AnarchyUpscaler } from './AnarchyUpscaler';
import { FluxUpscaler } from './FluxUpscaler';
import { MidjourneyTurboUpscaler } from './MidjourneyTurboUpscaler';

export class UpscalerFactory {
  static create(model: string): BaseUpscaler {
    const lowerModel = model.toLowerCase();
    
    if (
      lowerModel.includes('midjourney') ||
      lowerModel.includes('mj-turbo') ||
      lowerModel.includes('mj_turbo_upscale') ||
      lowerModel.includes('mj-fast') ||
      lowerModel.includes('mj_fast_upscale')
    ) {
      return new MidjourneyTurboUpscaler(model);
    }

    if (
      lowerModel.includes('real-esrgan') ||
      lowerModel.includes('fast-upscale') ||
      lowerModel === 'nightmareai/real-esrgan'
    ) {
      return new FastUpscaler();
    }
    
    if (
      lowerModel === 'anarchy' || 
      lowerModel.includes('anarchy-upscale') || 
      lowerModel.includes('clarity-pro') || 
      lowerModel.includes('philz1337x/clarity-pro-upscaler')
    ) {
      return new AnarchyUpscaler();
    }
    if (lowerModel === 'topaz' || lowerModel.includes('topazlabs/image-upscale')) {
      return new TopazUpscaler();
    }
    if (lowerModel === 'clarity' || lowerModel.includes('philz1337x/clarity-upscaler')) {
      return new ClarityUpscaler();
    }
    if (lowerModel === 'pruna' || lowerModel.includes('prunaai/p-image-upscale')) {
      return new PrunaUpscaler();
    }
    if (lowerModel === 'flux') {
      return new FluxUpscaler();
    }
    
    throw new Error(`Unsupported upscaler model: ${model}`);
  }
}
export default UpscalerFactory;
