/**
 * inpaintPayloadBuilder.ts
 * Prepares engine-specific payloads based on model mask capability:
 * 1. binary_mask (Flux Fill) -> Binary PNG mask image + prompt
 * 2. semantic_text (Nano Banana 2) -> Mask-free natural language spatial description
 * 3. hybrid (Nano Banana Pro) -> Binary PNG mask image + spatial text prompt
 */

export type MaskCapability = 'binary_mask' | 'semantic_text' | 'hybrid';

export interface AIModelEngine {
  id: string;
  name: string;
  role: 'upscale' | 'inpaint' | 'render';
  creditCost: number;
  maskCapability: MaskCapability;
}

export const ENGINE_REGISTRY: AIModelEngine[] = [
  { id: 'black-forest-labs/flux-fill-pro', name: 'Flux Fill Pro', role: 'inpaint', creditCost: 4, maskCapability: 'binary_mask' },
  { id: 'black-forest-labs/flux-fill-dev', name: 'Flux Fill Dev', role: 'inpaint', creditCost: 2, maskCapability: 'binary_mask' },
  { id: 'google/nano-banana-2', name: 'Nano Banana 2', role: 'inpaint', creditCost: 1, maskCapability: 'semantic_text' },
  { id: 'google/nano-banana-pro', name: 'Nano Banana Pro', role: 'inpaint', creditCost: 3, maskCapability: 'hybrid' },
  { id: 'black-forest-labs/flux-1.1-pro', name: 'Flux Pro Facade Precision', role: 'upscale', creditCost: 3, maskCapability: 'binary_mask' },
  { id: 'stabilityai/sdxl', name: 'SDXL Organic Detail', role: 'upscale', creditCost: 2, maskCapability: 'binary_mask' },
];

export interface DetectedElementInfo {
  label?: string;
  boundingBox?: { x: number; y: number; width: number; height: number };
}

/**
 * Builds API request body adapted specifically to engine mask capability.
 */
export async function buildInpaintPayload(
  engine: AIModelEngine,
  sourceImage: string,
  maskDataUrl: string | null,
  detectedElement: DetectedElementInfo | null,
  instructionPrompt: string
): Promise<Record<string, any>> {
  switch (engine.maskCapability) {
    case 'binary_mask':
      // Flux Fill — Requires true binary PNG mask
      return {
        image: sourceImage,
        mask: maskDataUrl || '',
        prompt: instructionPrompt,
        engineId: engine.id,
      };

    case 'semantic_text': {
      // Nano Banana 2 — Mask-Free, uses natural language spatial reasoning
      const regionDescription = detectedElement?.label
        ? `only the ${detectedElement.label} region`
        : describeRegionByBoundingBox(detectedElement?.boundingBox);

      return {
        image: sourceImage,
        prompt: `${instructionPrompt}, applied to ${regionDescription}, keep all other architectural elements strictly unchanged`,
        engineId: engine.id,
      };
    }

    case 'hybrid':
      // Nano Banana Pro — Combines binary PNG mask + spatial reasoning for maximum precision
      return {
        image: sourceImage,
        mask: maskDataUrl || '',
        prompt: instructionPrompt,
        engineId: engine.id,
      };
  }
}

function describeRegionByBoundingBox(box?: { x: number; y: number; width: number; height: number }): string {
  if (!box) return 'the designated selected area';
  const posX = box.x > 300 ? 'right' : 'left';
  const posY = box.y > 300 ? 'bottom' : 'top';
  return `the ${posY}-${posX} architectural region`;
}
