import { MODEL_META } from '../../../../services/replicate/ReplicateService';

export type ActiveToolType = 'markup' | 'comment' | 'erase' | 'resize' | null;

export interface CommentPin {
  id: string;
  xPct: number; // 0 - 100
  yPct: number; // 0 - 100
  text: string;
  num: number;
}

export const PRESET_COLORS = [
  '#ffffff', // White
  '#ef4444', // Red
  '#f59e0b', // Yellow
  '#10b981', // Green
  '#3b82f6', // Blue
  '#000000', // Black
];

export interface ResizeRatioOption {
  id: string;
  name: string;
  ratio: string;
  wireframeClass: string;
  wRatio: number;
  hRatio: number;
  resolutionHint?: string;
  description?: string;
}

export const ALL_RATIO_OPTIONS: Record<string, ResizeRatioOption> = {
  '1:1': { id: '1:1', name: 'Square', ratio: '1:1', wireframeClass: 'wf-square', wRatio: 1, hRatio: 1, resolutionHint: '1024 × 1024', description: 'Universal Square' },
  '16:9': { id: '16:9', name: 'Widescreen', ratio: '16:9', wireframeClass: 'wf-widescreen', wRatio: 16, hRatio: 9, resolutionHint: '1344 × 768', description: 'Landscape Display' },
  '9:16': { id: '9:16', name: 'Story / Reel', ratio: '9:16', wireframeClass: 'wf-story', wRatio: 9, hRatio: 16, resolutionHint: '768 × 1344', description: 'Mobile Full-Screen' },
  '4:3': { id: '4:3', name: 'Landscape', ratio: '4:3', wireframeClass: 'wf-landscape', wRatio: 4, hRatio: 3, resolutionHint: '1152 × 864', description: 'Classic Landscape' },
  '3:4': { id: '3:4', name: 'Portrait', ratio: '3:4', wireframeClass: 'wf-portrait', wRatio: 3, hRatio: 4, resolutionHint: '864 × 1152', description: 'Classic Portrait' },
  '3:2': { id: '3:2', name: 'Photo Landscape', ratio: '3:2', wireframeClass: 'wf-photo-land', wRatio: 3, hRatio: 2, resolutionHint: '1216 × 832', description: '35mm Camera' },
  '2:3': { id: '2:3', name: 'Poster / Portrait', ratio: '2:3', wireframeClass: 'wf-poster', wRatio: 2, hRatio: 3, resolutionHint: '832 × 1216', description: 'Poster & Book' },
  '21:9': { id: '21:9', name: 'Cinematic Ultrawide', ratio: '21:9', wireframeClass: 'wf-cinematic', wRatio: 21, hRatio: 9, resolutionHint: '1536 × 640', description: 'Anamorphic Ultrawide' },
  '4:5': { id: '4:5', name: 'Social Portrait', ratio: '4:5', wireframeClass: 'wf-portrait', wRatio: 4, hRatio: 5, resolutionHint: '896 × 1152', description: 'Feed Optimized' },
  '5:4': { id: '5:4', name: 'Social Landscape', ratio: '5:4', wireframeClass: 'wf-landscape', wRatio: 5, hRatio: 4, resolutionHint: '1152 × 896', description: 'Medium Format' },
  '2:1': { id: '2:1', name: 'Panoramic Header', ratio: '2:1', wireframeClass: 'wf-widescreen', wRatio: 2, hRatio: 1, resolutionHint: '1408 × 704', description: 'Banner & Header' },
  '1:2': { id: '1:2', name: 'Tall Skyscraper', ratio: '1:2', wireframeClass: 'wf-story', wRatio: 1, hRatio: 2, resolutionHint: '704 × 1408', description: 'Vertical Skyscraper' },
};

export const RESIZE_OPTIONS: ResizeRatioOption[] = [
  ALL_RATIO_OPTIONS['1:1'],
  ALL_RATIO_OPTIONS['3:4'],
  ALL_RATIO_OPTIONS['9:16'],
  ALL_RATIO_OPTIONS['4:3'],
  ALL_RATIO_OPTIONS['16:9'],
];

/**
 * Returns available aspect ratio options specifically supported by the active model engine.
 */
export function getEngineRatioOptions(modelName?: string): ResizeRatioOption[] {
  if (modelName && (MODEL_META as any)[modelName]?.aspectRatios) {
    const rawRatios: string[] = (MODEL_META as any)[modelName].aspectRatios;
    const cleanRatios = rawRatios.filter(
      (r) => r !== 'match_input_image' && r !== 'auto' && typeof r === 'string'
    );
    if (cleanRatios.length > 0) {
      return cleanRatios.map((r) => {
        if (ALL_RATIO_OPTIONS[r]) {
          return ALL_RATIO_OPTIONS[r];
        }
        const [wStr, hStr] = r.split(':');
        const w = Number(wStr) || 1;
        const h = Number(hStr) || 1;
        return {
          id: r,
          name: `Ratio ${r}`,
          ratio: r,
          wireframeClass: w > h ? 'wf-landscape' : w < h ? 'wf-portrait' : 'wf-square',
          wRatio: w,
          hRatio: h,
          resolutionHint: 'Engine Adaptive',
          description: `${r} Custom Ratio`,
        };
      });
    }
  }

  return [
    ALL_RATIO_OPTIONS['1:1'],
    ALL_RATIO_OPTIONS['16:9'],
    ALL_RATIO_OPTIONS['9:16'],
    ALL_RATIO_OPTIONS['4:3'],
    ALL_RATIO_OPTIONS['3:4'],
    ALL_RATIO_OPTIONS['3:2'],
    ALL_RATIO_OPTIONS['2:3'],
    ALL_RATIO_OPTIONS['21:9'],
  ];
}

/**
 * Returns a human-friendly display name for any model string.
 */
export function getEngineDisplayName(modelName?: string): string {
  if (!modelName) return 'Nano Banana 2';
  if (modelName.includes('nano-banana-2.1')) return 'Nano Banana 2.1';
  if (modelName.includes('nano-banana-2-lite')) return 'Nano Banana 2 Lite';
  if (modelName.includes('nano-banana-2')) return 'Nano Banana 2';
  if (modelName.includes('nano-banana-pro')) return 'Nano Banana Pro';
  if (modelName.includes('seedream-5-pro') || modelName.includes('seedream')) return 'Seedream 5 Pro';
  if (modelName.includes('flux-3')) return 'FLUX 3 Image';
  if (modelName.includes('gpt-image-2.5-flare')) return 'GPT Image 2.5 Flare';
  if (modelName.includes('gpt-image-2.5-sunburst')) return 'GPT Image 2.5 Sunburst';
  if (modelName.includes('gpt-image-2')) return 'GPT Image 2';
  if (modelName.includes('stable-diffusion-3.5') || modelName.includes('sd-3.5')) return 'SD 3.5 Large';
  if (modelName.includes('krea-2')) return 'Krea 2 Large';
  if (modelName.includes('p-image')) return 'Pruna P-Image';
  return modelName.split('/').pop() || modelName;
}
