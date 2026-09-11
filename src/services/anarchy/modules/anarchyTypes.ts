export type AnarchyModel = 'reve/edit-fast';

export interface AnarchyModelMeta {
  supportsImg2Img: boolean;
  supportsMultiImage: boolean;
  supportsSeed: boolean;
  supportsSteps: boolean;
  supportsNegativePrompt: boolean;
  supportsUpscale: boolean;
  supportsLoRA: boolean;
  supportsReferenceStrength: boolean;
  defaultSteps: number;
  stepsRange: [number, number];
  maxReferenceImages: number;
  resolutions: string[];
  aspectRatios: string[];
  pricePerImage: number;
  creditCost?: number;
}

export interface AnarchyGenerationParams {
  prompt: string;
  model: string;
  negativePrompt?: string;
  resolution?: string;
  aspectRatio?: string;
  steps?: number;
  seed?: number | null;
  cfg?: number;
  nodeId?: string;
  userId?: string;
  anarchyRemoveBackground?: boolean;
  anarchyUpscaleFactor?: 'Off' | '2x' | '3x' | '4x';
  anarchyEffect?: string;
}

export interface AnarchyGenerationResult {
  id: string;
  imageUrl: string;
  imageUrls?: string[];
  metadata: {
    model: string;
    prompt: string;
    width: number;
    height: number;
    seed: number;
    steps: number;
    generationTime: number;
    timestamp: number;
    layout?: any;
  };
}

export interface AnarchyPrediction {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  input: any;
  output: string | string[] | any;
  error: string | null;
  logs: string | null;
  version?: string;
}
