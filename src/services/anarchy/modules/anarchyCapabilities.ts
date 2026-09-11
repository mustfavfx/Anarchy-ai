import type { AnarchyModelMeta } from './anarchyTypes';

export function getModelCapabilities(model: string): AnarchyModelMeta {
  if (model === 'v2/create') {
    return {
      supportsImg2Img: true,
      supportsMultiImage: true,
      supportsSeed: false,
      supportsSteps: false,
      supportsNegativePrompt: false,
      supportsUpscale: true,
      supportsLoRA: false,
      supportsReferenceStrength: false,
      defaultSteps: 1,
      stepsRange: [1, 1],
      maxReferenceImages: 8,
      resolutions: ['Auto'],
      aspectRatios: ['auto', '1:1', '16:9', '9:16', '3:2', '2:3', '4:3', '3:4', '21:9', '9:21', 'match_input_image'],
      pricePerImage: 0.20,
      creditCost: 3.5
    };
  }
  if (model === 'reve/edit-fast' || model === 'reve/remix-fast') {
    return {
      supportsImg2Img: true,
      supportsMultiImage: true,
      supportsSeed: false,
      supportsSteps: false,
      supportsNegativePrompt: false,
      supportsUpscale: false,
      supportsLoRA: false,
      supportsReferenceStrength: false,
      defaultSteps: 1,
      stepsRange: [1, 1],
      maxReferenceImages: 8,
      resolutions: ['Auto'],
      aspectRatios: ['auto', '1:1', '16:9', '9:16', '3:2', '2:3', '4:3', '3:4', '21:9', '9:21', 'match_input_image'],
      pricePerImage: 0.007,
      creditCost: 0.4
    };
  }
  if (model === 'reve/create') {
    return {
      supportsImg2Img: true,
      supportsMultiImage: true,
      supportsSeed: false,
      supportsSteps: false,
      supportsNegativePrompt: false,
      supportsUpscale: false,
      supportsLoRA: false,
      supportsReferenceStrength: false,
      defaultSteps: 1,
      stepsRange: [1, 1],
      maxReferenceImages: 8,
      resolutions: ['Auto'],
      aspectRatios: ['auto', '1:1', '16:9', '9:16', '3:2', '2:3', '4:3', '3:4', 'match_input_image'],
      pricePerImage: 0.024,
      creditCost: 0.7
    };
  }
  if (model === 'reve/edit' || model === 'reve/remix') {
    return {
      supportsImg2Img: true,
      supportsMultiImage: true,
      supportsSeed: false,
      supportsSteps: false,
      supportsNegativePrompt: false,
      supportsUpscale: false,
      supportsLoRA: false,
      supportsReferenceStrength: false,
      defaultSteps: 1,
      stepsRange: [1, 1],
      maxReferenceImages: 8,
      resolutions: ['Auto'],
      aspectRatios: ['auto', '1:1', '16:9', '9:16', '3:2', '2:3', '4:3', '3:4', 'match_input_image'],
      pricePerImage: 0.04,
      creditCost: 1.0
    };
  }
  if (model.includes('extract-layout') || model.includes('render-layout') || model.includes('create-layout') || model.includes('reconcile-layouts') || model.includes('v2')) {
    return {
      supportsImg2Img: true,
      supportsMultiImage: true,
      supportsSeed: false,
      supportsSteps: false,
      supportsNegativePrompt: false,
      supportsUpscale: false,
      supportsLoRA: false,
      supportsReferenceStrength: false,
      defaultSteps: 1,
      stepsRange: [1, 1],
      maxReferenceImages: 8,
      resolutions: ['Auto'],
      aspectRatios: ['auto'],
      pricePerImage: 0.11,
      creditCost: 2.1
    };
  }
  return {
    supportsImg2Img: false,
    supportsMultiImage: false,
    supportsSeed: false,
    supportsSteps: false,
    supportsNegativePrompt: false,
    supportsUpscale: false,
    supportsLoRA: false,
    supportsReferenceStrength: false,
    defaultSteps: 1,
    stepsRange: [1, 1],
    maxReferenceImages: 0,
    resolutions: ['Auto'],
    aspectRatios: ['auto'],
    pricePerImage: 0.04,
    creditCost: 1.0
  };
}

export function getModelSettings(model: string) {
  const meta = getModelCapabilities(model);
  return {
    resolutions: meta.resolutions,
    aspectRatios: meta.aspectRatios,
    supportsSteps: meta.supportsSteps,
    supportsNegativePrompt: meta.supportsNegativePrompt,
    supportsUpscale: meta.supportsUpscale,
    supportsReferenceStrength: meta.supportsReferenceStrength,
    supportsMultiImage: meta.supportsMultiImage,
    supportsSeed: meta.supportsSeed,
    supportsLoRA: meta.supportsLoRA,
    supportsStyleType: false,
    supportsStylePreset: false,
    maxReferenceImages: meta.maxReferenceImages,
    defaultSteps: meta.defaultSteps,
    stepsRange: meta.stepsRange,
    styleTypes: [] as string[],
    stylePresets: [] as string[],
  };
}
