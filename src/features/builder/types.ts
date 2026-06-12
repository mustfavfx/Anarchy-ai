/**
 * AI Processing Graph Types
 * True node-based pipeline system like ComfyUI / Viz
 */

import type { Node } from '@xyflow/react';

// ============================================================================
// NODE TYPES - Core Processing States
// ============================================================================

export type NodeState = 'idle' | 'processing' | 'ready' | 'error';

export type NodeType = 'source' | 'ghost' | 'result';

export type ProcessingType = 
  | 'source'      // Original input image
  | 'render'      // AI render/generation
  | 'detail'      // Detail enhancement
  | 'upscale'     // Resolution increase
  | 'people'      // Add/remove people
  | 'daynight'    // Day to night conversion
  | 'lighting'    // Lighting adjustment
  | 'material'    // Material change
  | 'local'       // Local edit/inpainting
  | 'variation';  // Style variation

// ============================================================================
// DATA PACKET - Flows through edges
// ============================================================================

export interface DataPacket {
  image?: string;
  prompt?: string;
  metadata: {
    width?: number;
    height?: number;
    format?: string;
    timestamp: number;
    operationType: ProcessingType;
  };
  dimensions?: {
    width: number;
    height: number;
  };
}

// ============================================================================
// NODE LINEAGE - Ancestry tracking
// ============================================================================

export interface NodeLineage {
  parentId: string | null;
  rootSourceId: string;
  generation: number;      // Depth in the tree (0 = source)
  branchIndex: number;   // Which branch from parent
  processingType: ProcessingType;
  ancestry: string[];    // Full chain of parent IDs back to root
}

// ============================================================================
// BUILDER NODE DATA - Complete node specification
// ============================================================================

export interface BuilderNodeData extends Record<string, unknown> {
  // Core identification
  label: string;
  type: NodeType;
  processingType: ProcessingType;
  state: NodeState;
  
  // Content
  image?: string;
  originalImage?: string;
  prompt?: string;
  
  // Processing metadata
  createdAt: number;
  processedAt?: number;
  errorMessage?: string;
  predictionId?: string;    // Replicate prediction ID for tracking generation
  userId?: string;          // User ID for Realtime subscription
  
  // Lineage
  lineage: NodeLineage;
  
  // Input data (from parent via edge)
  inputData?: DataPacket;
  
  // Output data (produced by this node)
  outputData?: DataPacket;
  
  // Processing configuration
  config?: {
    strength?: number;
    seed?: number | null;
    steps?: number;
    cfg?: number;
    model?: string;
    resolution?: string;
    upscaleFactor?: number;
    [key: string]: any;
  };
  
  // For local edit/inpainting
  maskData?: string;
  localEditRegion?: { x: number; y: number; width: number; height: number };
  
  // Callbacks (injected by BuilderPage)
  onAddChild?: (processingType: ProcessingType) => void;
  onImageUpload?: (url: string) => void;
  onImagesUpload?: (urls: string[]) => void;
  onDelete?: () => void;
  onExecute?: (prompt: string) => void;
  onRetry?: () => void;
  // Performance: injected once from BuilderPage to avoid per-node Zustand subscriptions
  enableWatermark?: boolean;
}

// ============================================================================
// EDGE DATA - Data flow channel
// ============================================================================

export interface BuilderEdgeData extends Record<string, unknown> {
  packet?: DataPacket;
  isActive: boolean;
  lastUpdate: number;
}

// ============================================================================
// PROCESSING CONFIGURATION
// ============================================================================

export interface ProcessingConfig {
  id: ProcessingType;
  label: string;
  description: string;
  icon: string;
  color: string;
  supportsPrompt: boolean;
  inputRequired: ('image' | 'prompt')[];
  outputType: 'image';
}

export const PROCESSING_CONFIGS: Record<ProcessingType, ProcessingConfig> = {
  source: {
    id: 'source',
    label: 'Source',
    description: 'Original input image',
    icon: 'FileInput',
    color: '#e11d48',
    supportsPrompt: false,
    inputRequired: [],
    outputType: 'image'
  },
  render: {
    id: 'render',
    label: 'AI Render',
    description: 'Generate from prompt',
    icon: 'Wand2',
    color: '#10b981',
    supportsPrompt: true,
    inputRequired: ['image', 'prompt'],
    outputType: 'image'
  },
  detail: {
    id: 'detail',
    label: 'Detail',
    description: 'Enhance details',
    icon: 'Maximize',
    color: '#3b82f6',
    supportsPrompt: true,
    inputRequired: ['image'],
    outputType: 'image'
  },
  upscale: {
    id: 'upscale',
    label: 'Upscale',
    description: 'Increase resolution',
    icon: 'Maximize',
    color: '#8b5cf6',
    supportsPrompt: false,
    inputRequired: ['image'],
    outputType: 'image'
  },
  people: {
    id: 'people',
    label: 'People',
    description: 'Add/remove people',
    icon: 'Users',
    color: '#f59e0b',
    supportsPrompt: true,
    inputRequired: ['image', 'prompt'],
    outputType: 'image'
  },
  daynight: {
    id: 'daynight',
    label: 'Day/Night',
    description: 'Time conversion',
    icon: 'Moon',
    color: '#6366f1',
    supportsPrompt: true,
    inputRequired: ['image'],
    outputType: 'image'
  },
  lighting: {
    id: 'lighting',
    label: 'Lighting',
    description: 'Adjust lighting',
    icon: 'Sun',
    color: '#fbbf24',
    supportsPrompt: true,
    inputRequired: ['image'],
    outputType: 'image'
  },
  material: {
    id: 'material',
    label: 'Material',
    description: 'Change materials',
    icon: 'Palette',
    color: '#ec4899',
    supportsPrompt: true,
    inputRequired: ['image', 'prompt'],
    outputType: 'image'
  },
  local: {
    id: 'local',
    label: 'Local Edit',
    description: 'Inpainting',
    icon: 'Scissors',
    color: '#14b8a6',
    supportsPrompt: true,
    inputRequired: ['image', 'prompt'],
    outputType: 'image'
  },
  variation: {
    id: 'variation',
    label: 'Variation',
    description: 'Style variation',
    icon: 'RefreshCw',
    color: '#06b6d4',
    supportsPrompt: true,
    inputRequired: ['image'],
    outputType: 'image'
  }
};

// ============================================================================
// WORKFLOW STATS
// ============================================================================

export interface WorkflowStats {
  totalNodes: number;
  sourceNodes: number;
  ghostNodes: number;
  resultNodes: number;
  activeProcessing: number;
  maxDepth: number;
  totalBranches: number;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

export const isSourceNode = (node: Node): boolean => 
  (node.data as BuilderNodeData).type === 'source';

export const isGhostNode = (node: Node): boolean => 
  (node.data as BuilderNodeData).type === 'ghost';

export const isResultNode = (node: Node): boolean => 
  (node.data as BuilderNodeData).type === 'result';

export const canBranch = (node: Node): boolean => {
  const data = node.data as BuilderNodeData;
  return data.type === 'source' || data.type === 'result';
};

export const isReadyForExecution = (node: Node): boolean => {
  const data = node.data as BuilderNodeData;
  return data.type === 'ghost' && data.state === 'idle' && !!data.inputData?.image;
};

export const sanitizeEdges = (nodes: any[], edges: any[]): any[] => {
  const nodeIds = new Set(nodes.map(n => n.id));
  
  // 1. Filter out orphaned edges
  const validEdges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));

  // 2. Ensure correct handle IDs based on target node type
  return validEdges.map(e => {
    const targetNode = nodes.find(n => n.id === e.target);
    if (!targetNode) return e;

    const isGhost = targetNode.type === 'ghostNode' || (targetNode.data && targetNode.data.type === 'ghost');
    
    if (isGhost) {
      // If it is a ghost node, ensure it targets a ghost handle (e.g. ghost-target-X).
      // If targetHandle is not already a ghost-target handle, default to ghost-target-0.
      if (!e.targetHandle || !e.targetHandle.startsWith('ghost-target-')) {
        return {
          ...e,
          targetHandle: 'ghost-target-0'
        };
      }
      return e;
    } else {
      // If it is not a ghost node, it must target the 'target' handle
      if (e.targetHandle !== 'target') {
        return {
          ...e,
          targetHandle: 'target'
        };
      }
      return e;
    }
  });
};

export type BuilderNode = Node<BuilderNodeData>;
