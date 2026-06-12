import { type BaseUpscaler } from './BaseUpscaler';
import { TopazUpscaler } from './TopazUpscaler';
import { ClarityUpscaler } from './ClarityUpscaler';
import { PrunaUpscaler } from './PrunaUpscaler';
import { FluxUpscaler } from './FluxUpscaler';

export class UpscalerFactory {
  static create(model: string): BaseUpscaler {
    const lowerModel = model.toLowerCase();
    
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
