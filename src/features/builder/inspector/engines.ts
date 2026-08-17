/**
 * engines.ts
 * Engine registry + payload builder. Each inpaint-capable engine declares how
 * it wants the mask: a real binary mask image, a semantic text description,
 * or both.
 *
 * IDs are aligned with ReplicateService.ts model IDs.
 */

import type { AIModelEngine, DetectedElement } from './types';

// ── Inpaint Engines (real model IDs from ReplicateService) ──────────────────
export const INPAINT_ENGINE_REGISTRY: AIModelEngine[] = [
  {
    id: 'google/nano-banana-2',
    name: 'Nano Banana 2',
    role: 'inpaint',
    creditCost: 1,
    maskCapability: 'semantic_text',
  },
  {
    id: 'google/nano-banana-pro',
    name: 'Nano Banana Pro',
    role: 'inpaint',
    creditCost: 3,
    maskCapability: 'hybrid',
  },
  {
    id: 'reve/edit-fast',
    name: 'Reve Edit Fast',
    role: 'inpaint',
    creditCost: 2,
    maskCapability: 'semantic_text',
  },
];

// ── Upscale Engines ──────────────────────────────────────────────────────────
export const UPSCALE_ENGINE_REGISTRY: AIModelEngine[] = [
  {
    id: 'topazlabs/image-upscale',
    name: 'Topaz Upscale',
    role: 'upscale',
    creditCost: 4,
  },
  {
    id: 'philz1337x/clarity-upscaler',
    name: 'Clarity Upscaler',
    role: 'upscale',
    creditCost: 3,
  },
  {
    id: 'prunaai/p-image-upscale',
    name: 'Pruna Upscale',
    role: 'upscale',
    creditCost: 2,
  },
];

/** All engines combined — filter by role where needed */
export const ENGINE_REGISTRY: AIModelEngine[] = [
  ...INPAINT_ENGINE_REGISTRY,
  ...UPSCALE_ENGINE_REGISTRY,
];

// ── Mask → DataURL helper ────────────────────────────────────────────────────

/**
 * Converts an ImageData mask to a PNG data URL.
 * Uses OffscreenCanvas.convertToBlob if available (Tauri/worker).
 */
async function maskToDataUrl(mask: ImageData): Promise<string> {
  const canvas = new OffscreenCanvas(mask.width, mask.height);
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(mask, 0, 0);

  // Tauri + modern browsers: convertToBlob
  if ('convertToBlob' in canvas) {
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // Fallback: transfer to regular canvas
  const tmp = document.createElement('canvas');
  tmp.width = mask.width;
  tmp.height = mask.height;
  tmp.getContext('2d')!.putImageData(mask, 0, 0);
  return tmp.toDataURL('image/png');
}

/** Rough bounding-box-to-language fallback when there's no element label. */
function describeRegionByPosition(mask: ImageData): string {
  let minX = mask.width, minY = mask.height, maxX = 0, maxY = 0;
  for (let y = 0; y < mask.height; y++) {
    for (let x = 0; x < mask.width; x++) {
      if (mask.data[(y * mask.width + x) * 4] > 128) {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
    }
  }
  const cx = (minX + maxX) / 2 / mask.width;
  const cy = (minY + maxY) / 2 / mask.height;
  const h = cy < 0.4 ? 'top' : cy > 0.6 ? 'bottom' : 'middle';
  const v = cx < 0.4 ? 'left' : cx > 0.6 ? 'right' : 'center';
  return `the ${h}-${v} region of the image`;
}

export async function buildInpaintPayload(
  engine: AIModelEngine,
  sourceImage: string,
  maskData: ImageData,
  detectedElement: DetectedElement | null,
  instructionPrompt: string
): Promise<Record<string, unknown>> {
  switch (engine.maskCapability) {
    case 'binary_mask': {
      const maskUrl = await maskToDataUrl(maskData);
      return { image: sourceImage, mask: maskUrl, prompt: instructionPrompt, model: engine.id };
    }

    case 'semantic_text': {
      const regionDescription = detectedElement?.label
        ? `only the ${detectedElement.label} region`
        : describeRegionByPosition(maskData);
      return {
        image: sourceImage,
        prompt: `${instructionPrompt}, applied to ${regionDescription}, keep everything else unchanged`,
        model: engine.id,
      };
    }

    case 'hybrid': {
      const maskUrl = await maskToDataUrl(maskData);
      const regionDescription = detectedElement?.label
        ? `only the ${detectedElement.label} region`
        : describeRegionByPosition(maskData);
      return {
        image: sourceImage,
        mask: maskUrl,
        prompt: `${instructionPrompt}, applied to ${regionDescription}, keep everything else unchanged`,
        model: engine.id,
      };
    }

    default:
      // Upscale engines — no mask
      return { image: sourceImage, prompt: instructionPrompt, model: engine.id };
  }
}

/** Upscale payload — no mask needed */
export function buildUpscalePayload(
  engine: AIModelEngine,
  sourceImage: string,
  scaleMultiplier: number
): Record<string, unknown> {
  return {
    image: sourceImage,
    model: engine.id,
    scale: scaleMultiplier,
  };
}
