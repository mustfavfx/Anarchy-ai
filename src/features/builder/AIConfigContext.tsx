/**
 * Shared AI Configuration Context
 * Bridges state between RightSidebar (control panel) and BuilderPage (canvas)
 */

import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { ReplicateImageModel, ReplicateUpscaleModel } from '../../services/replicate';

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
  // Topaz Labs settings
  enhanceModel?: string;
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
  clarityPattern?: boolean;
  // Pruna AI settings
  prunaMode?: 'target' | 'factor';
  prunaTarget?: number;
  prunaFactor?: number;
  prunaEnhanceDetails?: boolean;
  prunaEnhanceRealism?: boolean;
  prunaQuality?: number;
}

export interface SelectedNodeInfo {
  id: string | null;
  type: 'source' | 'ghost' | 'result' | null;
  image: string | undefined;
  prompt: string | undefined;
  state: string | undefined;
}

export interface CompareImages {
  A: string | null;
  B: string | null;
}

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
  // Topaz Labs defaults
  enhanceModel: 'Low Resolution V2',
  faceEnhancement: false,
  faceEnhancementCreativity: 0,
  faceEnhancementStrength: 0.8,
  // Clarity Upscaler defaults
  clarityScale: 2,
  clarityDynamic: 6,
  clarityCreativity: 0.35,
  clarityTilingWidth: 112,
  clarityTilingHeight: 144,
  claritySdModel: 'juggernaut_reborn.safetensors',
  clarityScheduler: 'DPM++ 3M SDE Karras',
  claritySteps: 18,
  claritySeed: null,
  clarityDownscaling: false,
  clarityDownscalingRes: 768,
  claritySharpen: 0,
  clarityHandfix: 'disabled',
  clarityPattern: false,
  // Pruna AI defaults
  prunaMode: 'target',
  prunaTarget: 4,
  prunaFactor: 2,
  prunaEnhanceDetails: false,
  prunaEnhanceRealism: false,
  prunaQuality: 80,
};

interface AIConfigContextType {
  config: AIConfig;
  setConfig: React.Dispatch<React.SetStateAction<AIConfig>>;
  getConfig: () => AIConfig;
  selectedNode: SelectedNodeInfo;
  setSelectedNode: (node: SelectedNodeInfo) => void;
  compareImages: CompareImages;
  setCompareImages: React.Dispatch<React.SetStateAction<CompareImages>>;
  setCompareSlot: (slot: 'A' | 'B', imageUrl: string) => void;
  isPreviewExpanded: boolean;
  setIsPreviewExpanded: (expanded: boolean) => void;
  isSwappedView: boolean;
  setIsSwappedView: (swapped: boolean) => void;
  // Workflow snapshot for mini-map in sidebar
  workflowSnapshot: { nodes: Node[]; edges: Edge[] };
  setWorkflowSnapshot: (snap: { nodes: Node[]; edges: Edge[] }) => void;
}

const AIConfigContext = createContext<AIConfigContextType | null>(null);

export const AIConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<AIConfig>(DEFAULT_CONFIG);
  const configRef = useRef(config);
  configRef.current = config;

  // Always returns the latest config (useful inside async callbacks)
  const getConfig = useCallback(() => configRef.current, []);
  
  const [selectedNode, setSelectedNodeState] = useState<SelectedNodeInfo>({
    id: null,
    type: null,
    image: undefined,
    prompt: undefined,
    state: undefined,
  });
  
  const setSelectedNode = useCallback((node: SelectedNodeInfo) => {
    setSelectedNodeState(node);
  }, []);
  
  const [compareImages, setCompareImages] = useState<CompareImages>({ A: null, B: null });
  
  const setCompareSlot = useCallback((slot: 'A' | 'B', imageUrl: string) => {
    setCompareImages(prev => ({ ...prev, [slot]: imageUrl }));
  }, []);
  
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);
  const [isSwappedView, setIsSwappedView] = useState(false);
  const [workflowSnapshot, setWorkflowSnapshot] = useState<{ nodes: Node[]; edges: Edge[] }>({ nodes: [], edges: [] });

  return (
    <AIConfigContext.Provider value={{ config, setConfig, getConfig, selectedNode, setSelectedNode, compareImages, setCompareImages, setCompareSlot, isPreviewExpanded, setIsPreviewExpanded, isSwappedView, setIsSwappedView, workflowSnapshot, setWorkflowSnapshot }}>
      {children}
    </AIConfigContext.Provider>
  );
};

export const useAIConfig = (): AIConfigContextType => {
  const ctx = useContext(AIConfigContext);
  if (!ctx) throw new Error('useAIConfig must be used within AIConfigProvider');
  return ctx;
};
