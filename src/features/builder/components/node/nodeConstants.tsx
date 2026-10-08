import React from 'react';
import { 
  FileInput, Wand2, Sun, Moon, Users, 
  Maximize, Palette, Scissors, RefreshCw, Clapperboard, Sparkles,
  Building2, Armchair, User, Trees, Layers, Box, Paintbrush
} from 'lucide-react';
import type { ProcessingType } from '../../types';

export const SEMANTIC_CATEGORY_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  building: { label: 'Building', icon: <Building2 size={10} />, color: '#38bdf8' },
  interior: { label: 'Interior', icon: <Armchair size={10} />, color: '#a855f7' },
  person: { label: 'Person', icon: <User size={10} />, color: '#f59e0b' },
  landscape: { label: 'Landscape', icon: <Trees size={10} />, color: '#10b981' },
  material: { label: 'Material', icon: <Layers size={10} />, color: '#ec4899' },
  object: { label: 'Object', icon: <Box size={10} />, color: '#6366f1' },
  art: { label: 'Art / Style', icon: <Paintbrush size={10} />, color: '#f43f5e' },
  unknown: { label: 'Scene', icon: <Sparkles size={10} />, color: '#94a3b8' },
};

// Processing type configuration (all use brand red for unified identity)
export const PROCESSING_CONFIG: Record<ProcessingType, { icon: React.ReactNode; color: string; desc: string }> = {
  source: { icon: <FileInput size={12} />, color: '#e11d48', desc: 'Original input' },
  render: { icon: <Wand2 size={12} />, color: '#e11d48', desc: 'AI generation' },
  detail: { icon: <Maximize size={12} />, color: '#e11d48', desc: 'Detail enhancement' },
  upscale: { icon: <Maximize size={12} />, color: '#e11d48', desc: 'Resolution increase' },
  people: { icon: <Users size={12} />, color: '#e11d48', desc: 'Add/remove people' },
  daynight: { icon: <Moon size={12} />, color: '#e11d48', desc: 'Day to night' },
  lighting: { icon: <Sun size={12} />, color: '#e11d48', desc: 'Lighting adjust' },
  material: { icon: <Palette size={12} />, color: '#e11d48', desc: 'Material change' },
  local: { icon: <Scissors size={12} />, color: '#e11d48', desc: 'Local edit' },
  video: { icon: <Clapperboard size={12} />, color: '#e11d48', desc: 'Video generation' },
  variation: { icon: <RefreshCw size={12} />, color: '#e11d48', desc: 'Style variation' }
};

export const MODEL_NAME_FORMAT_MAP: Record<string, string> = {
  'midjourney/mj-turbo-upscale': 'Midjourney Turbo',
  'midjourney/mj-turbo-upscale-subtle': 'MJ Turbo Subtle',
  'midjourney/mj-turbo-upscale-creative': 'MJ Turbo Creative',
  'midjourney/mj-fast-upscale': 'Midjourney Fast',
  'midjourney/mj-fast-upscale-subtle': 'MJ Fast Subtle',
  'midjourney/mj-fast-upscale-creative': 'MJ Fast Creative',
  'mj-turbo-upscale': 'Midjourney Turbo',
  'mj_turbo_upscale': 'Midjourney Turbo',
  'nightmareai/real-esrgan': 'Fast AI Upscale',
  'real-esrgan': 'Fast AI Upscale',
  'philz1337x/clarity-pro-upscaler': 'Anarchy Upscale',
  'clarity-pro-upscaler': 'Anarchy Upscale',
  'topazlabs/image-upscale': 'Topaz Upscale',
  'image-upscale': 'Topaz Upscale',
  'prunaai/p-image-upscale': 'Pruna AI Upscale',
  'p-image-upscale': 'Pruna AI Upscale',
  'philz1337x/clarity-upscaler': 'Clarity Upscaler',
  'clarity-upscaler': 'Clarity Upscaler',
};

export function formatNodeTitle(label?: string, modelUsed?: string, processingType?: ProcessingType): string {
  if (!label) {
    if (processingType === 'source') return 'Source';
    if (processingType === 'upscale') return 'Image Upscaling';
    return 'Node';
  }

  const clean = label.trim();
  if (MODEL_NAME_FORMAT_MAP[clean]) return MODEL_NAME_FORMAT_MAP[clean];
  if (modelUsed && MODEL_NAME_FORMAT_MAP[modelUsed]) return MODEL_NAME_FORMAT_MAP[modelUsed];

  const lower = clean.toLowerCase();
  if (lower.includes('mj-turbo') || lower.includes('mj_turbo') || lower.includes('midjourney')) {
    return 'Midjourney Turbo';
  }

  if (lower === 'source') return 'Source';

  const lastPart = clean.includes('/') ? clean.split('/').pop() || clean : clean;
  if (MODEL_NAME_FORMAT_MAP[lastPart]) return MODEL_NAME_FORMAT_MAP[lastPart];

  if (lastPart.includes('-') || lastPart.includes('_')) {
    return lastPart
      .split(/[-_]/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  return clean;
}
