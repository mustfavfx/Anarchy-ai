import type React from 'react';
import type { PhotoshopBlendMode, InpaintLayer } from '../components/LayersPanel';

export type LayerId = 'image' | 'arrows' | 'selection';

export interface LayerVisibility {
  image?: boolean;
  arrows?: boolean;
  selection?: boolean;
}

export const INPAINT_ENGINES = [
  { id: 'black-forest-labs/flux-fill-pro', name: 'Flux Fill Pro (Architectural Photorealism)' },
  { id: 'black-forest-labs/flux-fill-dev', name: 'Flux Fill Dev (Fast Fill)' },
  { id: 'stabilityai/stable-diffusion-xl-inpaint', name: 'SDXL Inpaint (Classic Stable Diffusion)' },
  { id: 'reve/edit-fast', name: 'Reve Edit Fast' },
  { id: 'google/nano-banana-2', name: 'Nano Banana 2 (Gemini Fast)' },
  { id: 'google/nano-banana-pro', name: 'Nano Banana Pro' },
  { id: 'openai/gpt-image-2.5-flare', name: 'GPT Image 2.5 Flare' },
  { id: 'openai/gpt-image-2.5-sunburst', name: 'GPT Image 2.5 Sunburst' },
];

export interface MaskCanvasProps {
  image: string | null;
  originalImage?: string | null;
  onMaskChange?: (maskDataUrl: string | null) => void;
  onGenerate?: (compositeDataUrl: string, maskDataUrl: string, prompt: string, refImages?: string[], model?: string) => void;
  onCrop?: (croppedDataUrl: string) => void;
  showGenerateButton?: boolean;
  className?: string;
  isGenerating?: boolean;
  onClose?: () => void;
}

export type MaskTool = 'select' | 'brush' | 'eraser' | 'lasso' | 'crop' | 'wand' | 'arrow' | 'hand' | 'smart_select';
export type ShapeSubTool = 'polygon' | 'rectangle' | 'circle' | 'freehand';
export type DrawSubTool = 'brush' | 'arrow' | 'line' | 'rect' | 'circle';
export type WorkspaceMode = 'mask' | 'draw';

export interface Point {
  x: number;
  y: number;
}
