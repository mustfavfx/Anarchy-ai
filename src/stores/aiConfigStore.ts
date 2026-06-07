/**
 * AI Config Store - Zustand
 * Replaces AIConfigContext for better performance and simpler API
 */

import { create } from 'zustand';
import type { Node, Edge } from '@xyflow/react';
import type { ReplicateImageModel, ReplicateUpscaleModel } from '../services/replicate';

// ── Types ────────────────────────────────────────────────────────────────────

export type WatermarkPosition = 'top-left' | 'top-center' | 'top-right' | 'center' | 'bottom-left' | 'bottom-center' | 'bottom-right';

export interface AIConfig {
  model: ReplicateImageModel | ReplicateUpscaleModel;
  steps: number;
  cfg: number;
  seed: number | null;
  strength: number;
  referenceStrength: number;
  results: number;
  negativePrompt: string;
  disableSafetyChecker: boolean;
  upscaleFactor: number;
  resolution: string;
  aspectRatio: string;
  selectedTool: 'image-editor' | 'image-creator' | 'image-upscaler' | 'video-creator' | '3d-creator';
  // Watermark settings
  enableWatermark: boolean;
  watermarkType: 'text' | 'image';
  watermarkText: string;
  watermarkImage: string;
  watermarkImageSize: number;
  watermarkPosition: WatermarkPosition;
  watermarkOpacity: number;
  watermarkFontSize: number;
  // Topaz Labs settings
  enhanceModel?: string;
  topazUpscaleFactor?: string;
  topazSubjectDetection?: string;
  faceEnhancement?: boolean;
  faceEnhancementCreativity?: number;
  faceEnhancementStrength?: number;
  // Clarity Upscaler settings
  clarityScale?: number;
  clarityDynamic?: number;
  clarityCreativity?: number;
  clarityTilingWidth?: number;
  clarityTilingHeight?: number;
  claritySdModel?: string;
  clarityScheduler?: string;
  claritySteps?: number;
  claritySeed?: number | null;
  clarityDownscaling?: boolean;
  clarityDownscalingRes?: number;
  claritySharpen?: number;
  clarityHandfix?: string;
  clarityPattern?: string;
  clarityResemblance?: number;
  clarityOutputFormat?: string;
  // Pruna AI settings
  prunaMode?: 'target' | 'factor';
  prunaTarget?: number;
  prunaFactor?: number;
  prunaEnhanceDetails?: boolean;
  prunaEnhanceRealism?: boolean;
  prunaQuality?: number;
  prunaOutputFormat?: string;
  // Style settings
  styleType?: string;
  stylePreset?: string;
}

export interface SelectedNodeInfo {
  id: string | null;
  type: 'source' | 'ghost' | 'result' | null;
  image: string | undefined;
  originalImage?: string | undefined;
  prompt: string | undefined;
  state: string | undefined;
}

export interface CompareImages {
  A: string | null;
  B: string | null;
}

// ── Default Config ───────────────────────────────────────────────────────────

const DEFAULT_CONFIG: AIConfig = {
  model: 'google/nano-banana-2',
  steps: 50,
  cfg: 7.5,
  seed: null,
  strength: 0.75,
  referenceStrength: 0.85,
  results: 1,
  negativePrompt: '',
  disableSafetyChecker: false,
  upscaleFactor: 2,
  resolution: 'Auto',
  aspectRatio: '1:1',
  selectedTool: 'image-editor',
  // Watermark settings
  enableWatermark: true,
  watermarkType: 'text',
  watermarkText: 'Anarchy AI',
  watermarkImage: '',
  watermarkImageSize: 20,
  watermarkPosition: 'bottom-right',
  watermarkOpacity: 0.5,
  watermarkFontSize: 24,
  // Topaz Labs defaults
  enhanceModel: 'Low Resolution V2',
  topazUpscaleFactor: '4x',
  topazSubjectDetection: 'None',
  faceEnhancement: false,
  faceEnhancementCreativity: 0,
  faceEnhancementStrength: 0.8,
  // Clarity Upscaler defaults
  clarityScale: 2,
  clarityDynamic: 6,
  clarityCreativity: 0.35,
  clarityTilingWidth: 112,
  clarityTilingHeight: 144,
  claritySdModel: 'juggernaut_reborn.safetensors [338b85bc4f]',
  clarityScheduler: 'DPM++ 3M SDE Karras',
  claritySteps: 18,
  claritySeed: null,
  clarityDownscaling: false,
  clarityDownscalingRes: 768,
  claritySharpen: 0,
  clarityHandfix: 'disabled',
  clarityPattern: 'none',
  clarityResemblance: 0.6,
  clarityOutputFormat: 'png',
  // Pruna AI defaults
  prunaMode: 'target',
  prunaTarget: 4,
  prunaFactor: 2,
  prunaEnhanceDetails: false,
  prunaEnhanceRealism: true,
  prunaQuality: 80,
  prunaOutputFormat: 'png',
  // Style defaults
  styleType: 'None',
  stylePreset: 'None',
};

// ── Store State ──────────────────────────────────────────────────────────────

interface AIConfigState {
  // Config
  config: AIConfig;
  setConfig: (config: AIConfig | ((prev: AIConfig) => AIConfig)) => void;
  getConfig: () => AIConfig;
  updateConfig: (partial: Partial<AIConfig>) => void;
  
  // Selected Node
  selectedNode: SelectedNodeInfo;
  setSelectedNode: (node: SelectedNodeInfo) => void;
  clearSelectedNode: () => void;
  
  // Compare Images
  compareImages: CompareImages;
  setCompareImages: (images: CompareImages | ((prev: CompareImages) => CompareImages)) => void;
  setCompareSlot: (slot: 'A' | 'B', imageUrl: string) => void;
  clearCompareSlot: (slot: 'A' | 'B') => void;
  
  // UI State
  isPreviewExpanded: boolean;
  setIsPreviewExpanded: (expanded: boolean) => void;
  togglePreviewExpanded: () => void;

  isEnlargedView: boolean;
  setIsEnlargedView: (enlarged: boolean) => void;
  toggleEnlargedView: () => void;

  isSwappedView: boolean;
  setIsSwappedView: (swapped: boolean) => void;
  
  // Workflow Snapshot
  workflowSnapshot: { nodes: Node[]; edges: Edge[] };
  setWorkflowSnapshot: (snap: { nodes: Node[]; edges: Edge[] }) => void;

  // Canvas focus callback — registered by BuilderPage
  focusNodeFn: ((nodeId: string) => void) | null;
  setFocusNodeFn: (fn: ((nodeId: string) => void) | null) => void;

  // Node image update callback — registered by BuilderPage, called when crop/edit changes image
  nodeImageUpdateFn: ((nodeId: string, image: string) => void) | null;
  setNodeImageUpdateFn: (fn: ((nodeId: string, image: string) => void) | null) => void;
}

// ── Watermark Persistence Key ───────────────────────────────────────────────
const WM_KEY = 'anarchy_watermark_config';

function loadWatermarkConfig(): Partial<AIConfig> {
  try {
    const saved = localStorage.getItem(WM_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return {};
}

function saveWatermarkConfig(config: AIConfig) {
  try {
    // Store image separately to avoid bloating main config key
    if (config.watermarkImage) {
      localStorage.setItem(WM_KEY + '_img', config.watermarkImage);
    } else {
      localStorage.removeItem(WM_KEY + '_img');
    }
    const wm = {
      enableWatermark: config.enableWatermark,
      watermarkType: config.watermarkType,
      watermarkText: config.watermarkText,
      watermarkImage: '', // loaded separately
      watermarkImageSize: config.watermarkImageSize,
      watermarkPosition: config.watermarkPosition,
      watermarkOpacity: config.watermarkOpacity,
      watermarkFontSize: config.watermarkFontSize,
    };
    localStorage.setItem(WM_KEY, JSON.stringify(wm));
  } catch {}
}

function loadWatermarkImage(): string {
  try { return localStorage.getItem(WM_KEY + '_img') || ''; } catch { return ''; }
}

// ── Store Creation ─────────────────────────────────────────────────────────────

export const useAIConfigStore = create<AIConfigState>((set, get) => ({
  // Config — merge persisted watermark settings on init
  config: { ...DEFAULT_CONFIG, ...loadWatermarkConfig(), watermarkImage: loadWatermarkImage() },
  setConfig: (config) => {
    set((state) => {
      const next = typeof config === 'function' ? config(state.config) : config;
      saveWatermarkConfig(next);
      return { config: next };
    });
  },
  getConfig: () => get().config,
  updateConfig: (partial) => set((state) => {
    const next = { ...state.config, ...partial };
    saveWatermarkConfig(next);
    return { config: next };
  }),
  
  // Selected Node
  selectedNode: {
    id: null,
    type: null,
    image: undefined,
    originalImage: undefined,
    prompt: undefined,
    state: undefined,
  },
  setSelectedNode: (node) => set({ selectedNode: node }),
  clearSelectedNode: () => set({
    selectedNode: { id: null, type: null, image: undefined, prompt: undefined, state: undefined }
  }),
  
  // Compare Images
  compareImages: { A: null, B: null },
  setCompareImages: (images) => set((state) => ({
    compareImages: typeof images === 'function' ? images(state.compareImages) : images
  })),
  setCompareSlot: (slot, imageUrl) => set((state) => ({
    compareImages: { ...state.compareImages, [slot]: imageUrl }
  })),
  clearCompareSlot: (slot) => set((state) => ({
    compareImages: { ...state.compareImages, [slot]: null }
  })),
  
  // UI State
  isPreviewExpanded: false,
  setIsPreviewExpanded: (expanded) => set({ isPreviewExpanded: expanded }),
  togglePreviewExpanded: () => set((state) => ({ isPreviewExpanded: !state.isPreviewExpanded })),

  isEnlargedView: false,
  setIsEnlargedView: (enlarged) => set({ isEnlargedView: enlarged }),
  toggleEnlargedView: () => set((state) => ({ isEnlargedView: !state.isEnlargedView })),

  isSwappedView: false,
  setIsSwappedView: (swapped) => set({ isSwappedView: swapped }),
  
  // Workflow Snapshot
  workflowSnapshot: { nodes: [], edges: [] },
  setWorkflowSnapshot: (snap) => set({ workflowSnapshot: snap }),

  // Canvas focus callback
  focusNodeFn: null,
  setFocusNodeFn: (fn) => set({ focusNodeFn: fn }),

  // Node image update callback
  nodeImageUpdateFn: null,
  setNodeImageUpdateFn: (fn) => set({ nodeImageUpdateFn: fn }),
}));

// ── Selectors (for performance) ───────────────────────────────────────────────

export const selectConfig = (state: AIConfigState) => state.config;
export const selectSelectedNode = (state: AIConfigState) => state.selectedNode;
export const selectCompareImages = (state: AIConfigState) => state.compareImages;
export const selectIsPreviewExpanded = (state: AIConfigState) => state.isPreviewExpanded;
export const selectIsEnlargedView = (state: AIConfigState) => state.isEnlargedView;
export const selectWorkflowSnapshot = (state: AIConfigState) => state.workflowSnapshot;
