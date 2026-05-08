import { useCallback, useState, useMemo, useRef, useEffect } from 'react';
import { 
  useNodesState, 
  useEdgesState, 
  addEdge, 
  type Node, 
  type Edge, 
  type Connection,
  type XYPosition
} from '@xyflow/react';
import type { 
  ProcessingType, 
  BuilderNodeData, 
  DataPacket, 
  NodeLineage,
  NodeType,
  NodeState,
  WorkflowStats 
} from './types';
import { replicateService, type ReplicateImageModel, type ReplicateUpscaleModel } from '../../services/replicate';
import { useAIConfigStore } from '../../stores/aiConfigStore';
import { watermarkService } from '../../services/watermark/WatermarkService';
import { addHistoryEntry } from '../../services/history/HistoryService';
import { invoke } from '@tauri-apps/api/core';
import { STORAGE_KEYS } from '../../utils/storageKeys';
import { track } from '../../services/tracking/trackingService';

// Silent auto-save key — accepts optional tabId suffix for multi-tab isolation
const getAutosaveKey = (tabId?: string) =>
  tabId ? `${STORAGE_KEYS.BUILDER_AUTOSAVE}_${tabId}` : STORAGE_KEYS.BUILDER_AUTOSAVE;

// ── Upload helper: converts local/data-URI images ─────────────────────────────
// Nano Banana models accept base64 data URIs directly (best quality, no expiry)
// Other models (FLUX, GPT, etc.) need public URLs via upload service
async function uploadImageIfLocal(url: string, model?: string): Promise<string> {
  if (!url) return url;
  // Models that support base64 data URIs directly (best quality, no expiry)
  const supportsBase64 = model?.startsWith('google/nano-banana') || 
                         model === 'bytedance/seedream-4.5' ||
                         model === 'openai/gpt-image-2';
  // Already base64 - use directly
  if (supportsBase64 && url.startsWith('data:')) {
    return url;
  }
  // For GPT Image 2 with public URL - download and convert to base64
  if (model === 'openai/gpt-image-2' && (url.startsWith('https://') || url.startsWith('http://'))) {
    try {
      const base64Data: string = await invoke('url_to_base64', { url });
      return base64Data;
    } catch {
      // Fallback: use fetch to download image
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
        });
        reader.readAsDataURL(blob);
        const base64Data = await base64Promise;
        return base64Data;
      } catch {
        return url;
      }
    }
  }
  // Already a public URL - return as-is for other models
  if (url.startsWith('https://') || url.startsWith('http://')) return url;
  // For other models or non-data URIs, upload to get public URL
  try {
    const publicUrl: string = await invoke('upload_image', { apiKey: '', dataUri: url });
    return publicUrl;
  } catch {
    return url;
  }
}

async function persistImageLocally(url: string): Promise<string> {
  if (!url || url.startsWith('data:') || url.startsWith('blob:')) return url;

  try {
    const base64Data: string = await invoke('url_to_base64', { url });
    if (base64Data?.startsWith('data:')) return base64Data;
  } catch {
    // Tauri invoke unavailable (dev browser) — return original URL
  }

  return url;
}

// AI generation config passed to executeNode
export interface GenerationConfig {
  model: ReplicateImageModel | ReplicateUpscaleModel;
  resolution?: string;
  aspectRatio?: string;
  steps?: number;
  cfg?: number;
  seed?: number | null;
  strength?: number;
  referenceStrength?: number;
  disableSafetyChecker?: boolean;
  upscaleFactor?: number;
  negativePrompt?: string;
  // Watermark settings
  enableWatermark?: boolean;
  watermarkText?: string;
  watermarkPosition?: import('../../stores/aiConfigStore').WatermarkPosition;
  watermarkOpacity?: number;
  watermarkFontSize?: number;
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

// Re-export types for backward compatibility
export type { ProcessingType, BuilderNodeData, DataPacket, NodeLineage, NodeType, NodeState, WorkflowStats };

// ============================================================================
// CONSTANTS
// ============================================================================

const HORIZONTAL_SPACING = 400;
const VERTICAL_SPACING = 220;

// Type labels for UI
const TYPE_LABELS: Record<ProcessingType, string> = {
  source: 'Source',
  render: 'AI Render',
  detail: 'Detail Edit',
  upscale: 'Upscale',
  people: 'Add People',
  daynight: 'Day to Night',
  lighting: 'Lighting',
  material: 'Materials',
  local: 'Local Edit',
  variation: 'Variation'
};

// ============================================================================
// DATA PACKET UTILITIES
// ============================================================================

const createDataPacket = (
  image: string | undefined,
  prompt: string | undefined,
  operationType: ProcessingType,
  dimensions?: { width: number; height: number }
): DataPacket => ({
  image,
  prompt,
  metadata: {
    timestamp: Date.now(),
    operationType,
    format: 'png',
    width: dimensions?.width,
    height: dimensions?.height
  },
  dimensions
});

// ============================================================================
// EDGE FACTORY - Data carrying edges
// ============================================================================

interface EdgeOptions {
  animated?: boolean;
  isDataFlow?: boolean;
  packet?: DataPacket;
}

const createEdge = (
  sourceId: string, 
  targetId: string, 
  options: EdgeOptions = {}
): Edge => {
  const { animated = false, packet } = options;
  
  return {
    id: `e-${sourceId}-${targetId}`,
    source: sourceId,
    target: targetId,
    sourceHandle: 'source',
    targetHandle: 'ghost-target-0', // GhostNode uses ghost-target-0, ghost-target-1, etc.
    type: 'default',
    animated,
    style: { 
      strokeWidth: packet ? 2 : 1.5,
      stroke: packet ? 'rgba(225, 29, 72, 0.5)' : 'rgba(255,255,255,0.15)',
      opacity: packet ? 1 : 0.7
    },
    data: {
      packet,
      isActive: !!packet,
      lastUpdate: Date.now()
    }
  };
};

// ============================================================================
// MAIN HOOK - AI Processing Graph Engine
// ============================================================================

// Snapshot type for undo/redo
interface HistorySnapshot { nodes: Node[]; edges: Edge[]; }

const MAX_HISTORY = 50;

export const useBuilderWorkflow = (tabId?: string) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  // Refs to track current state for callbacks without circular deps
  const nodesRef = useRef<Node[]>(nodes);
  const edgesRef = useRef<Edge[]>(edges);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const processingQueue = useRef<Set<string>>(new Set());
  const [isRestored, setIsRestored] = useState(false);

  // ── Undo/Redo history ──────────────────────────────────────────────────────
  const past   = useRef<HistorySnapshot[]>([]);
  const future = useRef<HistorySnapshot[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const syncUndoRedoState = useCallback(() => {
    setCanUndo(past.current.length > 0);
    setCanRedo(future.current.length > 0);
  }, []);

  // Call before any structural change (add/delete node, execute)
  const pushHistory = useCallback((currentNodes: Node[], currentEdges: Edge[]) => {
    past.current = [...past.current.slice(-MAX_HISTORY + 1), { nodes: currentNodes, edges: currentEdges }];
    future.current = []; // clear redo stack on new action
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const undo = useCallback(() => {
    if (past.current.length === 0) return;
    const snapshot = past.current[past.current.length - 1];
    past.current = past.current.slice(0, -1);
    future.current = [{ nodes, edges }, ...future.current.slice(0, MAX_HISTORY - 1)];
    setNodes(snapshot.nodes);
    setEdges(snapshot.edges);
    syncUndoRedoState();
  }, [nodes, edges, setNodes, setEdges, syncUndoRedoState]);

  const redo = useCallback(() => {
    if (future.current.length === 0) return;
    const snapshot = future.current[0];
    future.current = future.current.slice(1);
    past.current = [...past.current.slice(-MAX_HISTORY + 1), { nodes, edges }];
    setNodes(snapshot.nodes);
    setEdges(snapshot.edges);
    syncUndoRedoState();
  }, [nodes, edges, setNodes, setEdges, syncUndoRedoState]);

  // ========================================================================
  // SILENT AUTO-SAVE: Restore from localStorage on mount (no console logs)
  // ========================================================================
  useEffect(() => {
    if (isRestored) return;
    
    try {
      const saved = localStorage.getItem(getAutosaveKey(tabId));
      if (saved) {
        const data = JSON.parse(saved);
        if (data.nodes && data.nodes.length > 0) {
          setNodes(data.nodes);
          setEdges(data.edges || []);
        }
      }
    } catch {
      // Silent fail - no console output
    }
    setIsRestored(true);
  }, [isRestored, tabId, setNodes, setEdges]);

  // ========================================================================
  // SILENT AUTO-SAVE: Save to localStorage whenever nodes/edges change
  // ========================================================================
  useEffect(() => {
    if (!isRestored) return;
    
    const timeoutId = setTimeout(() => {
      try {
        const key = getAutosaveKey(tabId);
        const saved = localStorage.getItem(key);
        const previous = saved ? JSON.parse(saved) : {};
        const data = { ...previous, nodes, edges };
        localStorage.setItem(key, JSON.stringify(data));
      } catch {
        // Silent fail - no console output
      }
    }, 2000); // Debounce 2 seconds
    
    return () => clearTimeout(timeoutId);
  }, [nodes, edges, isRestored, tabId]);

  // ========================================================================
  // UTILITY FUNCTIONS
  // ========================================================================

  const getNode = useCallback((nodeId: string): Node | undefined => {
    return nodes.find(n => n.id === nodeId);
  }, [nodes]);

  const getNodeData = useCallback((nodeId: string): BuilderNodeData | undefined => {
    const node = getNode(nodeId);
    return node?.data as BuilderNodeData | undefined;
  }, [getNode]);

  const getChildren = useCallback((nodeId: string): Node[] => {
    return nodes.filter(n => {
      const edge = edges.find(e => e.target === n.id && e.source === nodeId);
      return !!edge;
    });
  }, [nodes, edges]);

  const getParent = useCallback((nodeId: string): Node | undefined => {
    const edge = edges.find(e => e.target === nodeId);
    return edge ? nodes.find(n => n.id === edge.source) : undefined;
  }, [nodes, edges]);

  // Get ALL parents for multi-input aggregation (e.g., ghost nodes)
  const getAllParents = useCallback((nodeId: string): Node[] => {
    const parentEdges = edges.filter(e => e.target === nodeId);
    return parentEdges
      .map(e => nodes.find(n => n.id === e.source))
      .filter((n): n is Node => !!n);
  }, [nodes, edges]);

  // ========================================================================
  // POSITION CALCULATION - Auto layout
  // ========================================================================

  const calculateChildPosition = useCallback((parentId: string): XYPosition => {
    const parent = getNode(parentId);
    if (!parent) return { x: 80, y: 280 };

    const siblings = getChildren(parentId);
    const siblingCount = siblings.length;
    
    const direction = siblingCount % 2 === 0 ? 1 : -1;
    const offsetMultiplier = Math.ceil(siblingCount / 2);
    const yOffset = direction * offsetMultiplier * VERTICAL_SPACING;
    
    return {
      x: parent.position.x + HORIZONTAL_SPACING,
      y: parent.position.y + yOffset
    };
  }, [getNode, getChildren]);

  // ========================================================================
  // DATA FLOW PROPAGATION - Reactive updates
  // ========================================================================

  const propagateNodeUpdate = useCallback((nodeId: string): void => {
    const node = getNode(nodeId);
    if (!node) return;

    const nodeData = node.data as BuilderNodeData;
    const children = getChildren(nodeId);

    // Create output packet from this node
    const outputPacket = createDataPacket(
      nodeData.image,
      nodeData.prompt,
      nodeData.processingType
    );

    // Update this node's output data
    setNodes(nds => nds.map(n => 
      n.id === nodeId 
        ? { ...n, data: { ...n.data, outputData: outputPacket } }
        : n
    ));

    // Propagate to all children — single batch update for nodes and edges
    const childIds = new Set(children.map(c => c.id));
    const edgeTimestamp = Date.now();

    setNodes(nds => nds.map(n => {
      if (!childIds.has(n.id)) return n;
      const childData = n.data as BuilderNodeData;
      return {
        ...n,
        data: {
          ...childData,
          inputData: outputPacket,
          image: childData.type === 'ghost' ? outputPacket.image : childData.image,
        }
      };
    }));

    setEdges(eds => eds.map(e => {
      if (!childIds.has(e.target) || e.source !== nodeId) return e;
      return { ...e, data: { ...e.data, packet: outputPacket, isActive: true, lastUpdate: edgeTimestamp } };
    }));
  }, [getNode, getChildren, setNodes, setEdges]);

  const findDownstreamNodes = useCallback((nodeId: string): string[] => {
    const downstream: string[] = [];
    const visited = new Set<string>();
    
    const traverse = (currentId: string) => {
      if (visited.has(currentId)) return;
      visited.add(currentId);
      
      const children = getChildren(currentId);
      children.forEach(child => {
        downstream.push(child.id);
        traverse(child.id);
      });
    };
    
    traverse(nodeId);
    return downstream;
  }, [getChildren]);

  // ========================================================================
  // NODE LIFECYCLE - Source → Ghost → Result
  // ========================================================================

  const createSourceNode = useCallback((imageUrl?: string): string => {
    const id = `source-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    
    const lineage: NodeLineage = {
      parentId: null,
      rootSourceId: id,
      generation: 0,
      branchIndex: 0,
      processingType: 'source',
      ancestry: []
    };

    const packet = imageUrl ? createDataPacket(imageUrl, undefined, 'source') : undefined;

    const newNode: Node = {
      id,
      type: 'baseNode',
      position: { x: 80, y: 300 },
      data: {
        label: 'Source',
        type: 'source',
        processingType: 'source',
        state: imageUrl ? 'ready' : 'idle',
        image: imageUrl,
        createdAt: Date.now(),
        lineage,
        inputData: undefined,
        outputData: packet,
        config: {}
      } as BuilderNodeData
    };

    pushHistory(nodesRef.current, edgesRef.current); // snapshot before adding
    setNodes(nds => [...nds, newNode]);

    if (imageUrl) {
      try {
        addHistoryEntry({
          type: 'edit',
          label: 'Source imported',
          outputImage: imageUrl,
        });
      } catch {}
    }

    return id;
  }, [setNodes]);

  const spawnGhostNode = useCallback((
    parentId: string,
    processingType: ProcessingType
  ): string | null => {
    const parent = getNode(parentId);
    if (!parent) throw new Error(`Parent node ${parentId} not found`);
    
    // Only source and result nodes can spawn ghosts
    const parentData = parent.data as BuilderNodeData;
    if (parentData.type === 'ghost') {
      throw new Error('Ghost nodes cannot spawn children');
    }

    // Only toggle-delete an IDLE ghost (one that hasn't taken work yet).
    // Ghosts that are processing/ready/error must persist so the user can
    // spawn additional ghosts from the same parent for branching workflows.
    const existingIdleGhost = getChildren(parentId).find(n => {
      const d = n.data as BuilderNodeData;
      return d.type === 'ghost' && d.state === 'idle';
    });
    
    if (existingIdleGhost) {
      setNodes(nds => nds.filter(n => n.id !== existingIdleGhost.id));
      setEdges(eds => eds.filter(e => e.target !== existingIdleGhost.id));
      return null;
    }

    const id = `ghost-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const position = calculateChildPosition(parentId);

    const parentLineage = parentData.lineage;
    const lineage: NodeLineage = {
      parentId,
      rootSourceId: parentLineage.rootSourceId,
      generation: parentLineage.generation + 1,
      branchIndex: 0,
      processingType,
      ancestry: [...parentLineage.ancestry, parentId]
    };

    const baseLabel = TYPE_LABELS[processingType];

    // Get parent output for input data (but ghost doesn't inherit image visually)
    const parentOutput = parentData.outputData;
    
    const newNode: Node = {
      id,
      type: 'ghostNode',
      position,
      data: {
        label: baseLabel,
        type: 'ghost',
        processingType,
        state: 'idle',
        image: undefined, // Ghost is empty, no image inherited
        createdAt: Date.now(),
        lineage,
        inputData: parentOutput,
        outputData: undefined,
        prompt: undefined,
        config: {}
      } as BuilderNodeData
    };

    setNodes(nds => [...nds, newNode]);
    
    // Create data-carrying edge
    setEdges(eds => [...eds, createEdge(parentId, id, { 
      animated: false, 
      isDataFlow: true,
      packet: parentOutput 
    })]);

    return id;
  }, [getNode, getChildren, calculateChildPosition, setNodes, setEdges]);

  const executeNode = useCallback(async (
    nodeId: string,
    prompt: string,
    config?: GenerationConfig
  ): Promise<void> => {
    const node = getNode(nodeId);
    if (!node) throw new Error(`Node ${nodeId} not found`);

    const nodeData = node.data as BuilderNodeData;
    
    // Validate: only ghost nodes can be executed
    if (nodeData.type !== 'ghost') {
      throw new Error(`Cannot execute ${nodeData.type} node`);
    }

    // Check if already processing
    if (processingQueue.current.has(nodeId)) {
      throw new Error('Node is already processing');
    }

    const _execStartTime = Date.now();
    const model = config?.model || 'google/nano-banana-2';
    
    // Get source image(s) ONLY from directly connected parent nodes
    // Never fall back to random source nodes - each ghost only uses its own inputs
    const allParentImages: string[] = [];
    
    // Priority 1: inputData (pre-set data packet)
    if (nodeData.inputData?.image) {
      allParentImages.push(nodeData.inputData.image);
    }
    
    // Priority 2: ALL directly connected parent nodes via edges
    const parentNodes = getAllParents(nodeId);
    parentNodes.forEach(parentNode => {
      const parentData = parentNode.data as BuilderNodeData;
      const img = parentData.outputData?.image || parentData.image;
      if (img && !allParentImages.includes(img)) {
        allParentImages.push(img);
      }
    });
    
    
    // Upload images based on model requirements
    const uploadedImages = await Promise.all(
      allParentImages.map(img => uploadImageIfLocal(img, model as string))
    );

    // Primary source image is the first connected one
    const sourceImage = uploadedImages[0];
    
    // Check if using an upscale model (Replicate upscale models)
    const isUpscaleModel = (model as string) === 'topazlabs/image-upscale'
      || (model as string) === 'nightmareai/real-esrgan'
      || (model as string) === 'philz1337x/clarity-upscaler'
      || (model as string) === 'prunaai/p-image-upscale';
    if (isUpscaleModel && !sourceImage) {
      throw new Error('Upscaling engines require a source image. Please upload or connect an image first.');
    }

    processingQueue.current.add(nodeId);

    // Update to processing state
    setNodes(nds => nds.map(n => 
      n.id === nodeId 
        ? { 
            ...n, 
            data: { 
              ...n.data, 
              state: 'processing',
              prompt,
              config: { ...config }
            } 
          }
        : n
    ));

    try {
      const sourceDims = nodeData.inputData?.dimensions;
      let result: { imageUrl: string; metadata: { width: number; height: number; model: string; prompt: string } };

      // For upscale models, use upscaleImage API
      if (isUpscaleModel) {
        const scale = config?.upscaleFactor || 4;
        const resultUrl = await replicateService.upscaleImage(
          sourceImage,
          model as import('../../services/replicate').ReplicateUpscaleModel,
          scale,
          {
            prompt: config?.negativePrompt, // Use as enhancement prompt for clarity
            negativePrompt: config?.negativePrompt,
            steps: config?.steps,
            seed: config?.seed ?? undefined,
            // Topaz Labs settings
            enhanceModel: config?.enhanceModel,
            faceEnhancement: config?.faceEnhancement,
            faceEnhancementCreativity: config?.faceEnhancementCreativity,
            faceEnhancementStrength: config?.faceEnhancementStrength,
            // Clarity Upscaler settings
            clarityScale: config?.clarityScale,
            clarityDynamic: config?.clarityDynamic,
            clarityCreativity: config?.clarityCreativity,
            clarityTilingWidth: config?.clarityTilingWidth,
            clarityTilingHeight: config?.clarityTilingHeight,
            claritySdModel: config?.claritySdModel,
            clarityScheduler: config?.clarityScheduler,
            claritySteps: config?.claritySteps,
            claritySeed: config?.claritySeed ?? undefined,
            clarityDownscaling: config?.clarityDownscaling,
            clarityDownscalingRes: config?.clarityDownscalingRes,
            claritySharpen: config?.claritySharpen,
            clarityHandfix: config?.clarityHandfix,
            clarityPattern: config?.clarityPattern,
            // Pruna AI settings
            prunaMode: config?.prunaMode,
            prunaTarget: config?.prunaTarget,
            prunaFactor: config?.prunaFactor,
            prunaEnhanceDetails: config?.prunaEnhanceDetails,
            prunaEnhanceRealism: config?.prunaEnhanceRealism,
            prunaQuality: config?.prunaQuality,
          }
        );
        
        result = {
          imageUrl: resultUrl,
          metadata: {
            width: sourceDims?.width ? sourceDims.width * scale : 1024,
            height: sourceDims?.height ? sourceDims.height * scale : 1024,
            model: model as string,
            prompt: prompt || 'Upscale',
          }
        };
      } else {
        // For regular image models, use generate or generateImg2Img
        const baseParams = {
          prompt,
          model: model as import('../../services/replicate').ReplicateImageModel,
          negativePrompt: config?.negativePrompt,
          resolution: config?.resolution || 'Auto',
          aspectRatio: config?.aspectRatio || 'Auto',
          steps: config?.steps,
          cfg: config?.cfg,
          seed: config?.seed ?? undefined,
          strength: config?.strength,
          referenceStrength: config?.referenceStrength,
          disableSafetyChecker: config?.disableSafetyChecker,
          sourceWidth: sourceDims?.width,
          sourceHeight: sourceDims?.height,
        };

        // Choose generation mode based on model capabilities and available images
        const modelCaps = replicateService.getModelCapabilities(
          model as import('../../services/replicate').ReplicateImageModel
        );
        const useImg2Img = sourceImage && modelCaps.supportsImg2Img;
        result = useImg2Img
          ? await replicateService.generateImg2Img(baseParams, uploadedImages)
          : await replicateService.generate(baseParams);
      }

      const resultImage = await persistImageLocally(result.imageUrl);
      
      // Apply watermark if enabled
      let finalImage = resultImage;
      const aiConfig = useAIConfigStore.getState().config;
      const wmEnabled = aiConfig.enableWatermark && (aiConfig.watermarkType === 'image' ? !!aiConfig.watermarkImage : !!aiConfig.watermarkText);
      if (wmEnabled) {
        try {
          finalImage = await watermarkService.applyWatermark(resultImage, {
            type: aiConfig.watermarkType || 'text',
            text: aiConfig.watermarkText,
            watermarkImage: aiConfig.watermarkImage,
            watermarkImageSize: aiConfig.watermarkImageSize,
            position: aiConfig.watermarkPosition,
            opacity: aiConfig.watermarkOpacity,
            fontSize: aiConfig.watermarkFontSize,
          });
        } catch {
        }
      }
      
      const outputPacket = createDataPacket(
        finalImage,
        prompt,
        nodeData.processingType,
        { width: result.metadata.width, height: result.metadata.height }
      );

      try {
        const parent = getParent(nodeId);
        const parentImage = parent ? (parent.data as BuilderNodeData).image : undefined;
        const modelId = model as string;
        addHistoryEntry({
          type: (nodeData.processingType as any) === 'upscale' ? 'upscale' : 'render',
          label: prompt && prompt.length > 50 ? prompt.slice(0, 50) + '...' : (prompt || 'Generation'),
          prompt,
          model: modelId,
          inputImage: parentImage,
          outputImage: finalImage,
          duration: Date.now() - _execStartTime,
        });
        const isUpscale = (nodeData.processingType as any) === 'upscale';
        track({
          event: isUpscale ? 'image_upscaled' : 'image_generated',
          properties: {
            model: modelId,
            duration_ms: Date.now() - _execStartTime,
            has_prompt: Boolean(prompt),
          },
        }).catch(() => {});
      } catch {}

      // Auto-save generated image to Documents/Anarchy AI
      try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const safeName = (prompt || 'generation').replace(/[^a-zA-Z0-9\u0600-\u06FF\s]/g, '').trim().slice(0, 40).replace(/\s+/g, '_') || 'generation';
        const fileName = `${timestamp}_${safeName}.png`;
        await invoke('save_image_to_documents', { dataUri: finalImage, fileName });
      } catch { /* Non-critical — silently ignore */ }

      // Map model IDs to human-readable display names for the result title
      const MODEL_DISPLAY_NAMES: Record<string, string> = {
        'google/nano-banana-2':             'Nano Banana 2',
        'google/nano-banana-pro':           'Nano Banana Pro',
        'bytedance/seedream-4.5':           'Seedream 4.5',
        'black-forest-labs/flux-2-pro':     'FLUX 2 Pro',
        'openai/gpt-image-2':               'GPT Image 2',
        'bytedance/seedance-2.0':           'Seedance 2',
        'black-forest-labs/flux-kontext-pro':'FLUX Kontext Pro',
        'xai/grok-imagine-image':           'Grok Imagine',
        'nightmareai/real-esrgan':          'Real-ESRGAN',
        'philz1337x/clarity-upscaler':      'Clarity Upscaler',
      };
      const modelLabel = MODEL_DISPLAY_NAMES[model] || model.split('/').pop() || model;

      setNodes(nds => nds.map(n => {
        if (n.id !== nodeId) return n;
        
        return {
          ...n,
          type: 'baseNode', // Switch React Flow renderer so image is displayed
          data: {
            ...n.data,
            type: 'result', // TRANSFORM: Ghost becomes Result
            state: 'ready',
            label: modelLabel,
            modelUsed: model,
            prompt,
            image: finalImage,
            outputData: outputPacket,
            dimensions: { width: result.metadata.width, height: result.metadata.height },
            processedAt: Date.now()
          }
        };
      }));

      pushHistory(nodesRef.current, edgesRef.current); // snapshot before result lands

      // Update edges targeting this node: ghost handle 'ghost-target-0' -> BaseNode handle 'target'
      setEdges(eds => eds.map(e => 
        e.target === nodeId 
          ? { ...e, targetHandle: 'target' } 
          : e
      ));

      // Propagate update to children
      propagateNodeUpdate(nodeId);

    } catch (error) {
      console.error('Generation failed:', error);
      setNodes(nds => nds.map(n => 
        n.id === nodeId 
          ? { 
              ...n, 
              data: { 
                ...n.data, 
                state: 'error',
                errorMessage: error instanceof Error ? error.message : 'Generation failed'
              } 
            }
          : n
      ));
    } finally {
      processingQueue.current.delete(nodeId);
    }
  }, [getNode, getParent, nodes, setNodes, propagateNodeUpdate]);

  // ========================================================================
  // LEGACY COMPATIBILITY - Bridge to old API
  // ========================================================================

  const addChildNode = useCallback((
    parentId: string,
    processingType: ProcessingType
  ): string => {
    // New API: Always spawn a ghost node
    return spawnGhostNode(parentId, processingType);
  }, [spawnGhostNode]);

  const executeProcessing = useCallback((
    nodeId: string,
    prompt: string,
    options?: { strength?: number; seed?: number }
  ): void => {
    // Async wrapper for sync API compatibility (legacy)
    executeNode(nodeId, prompt, {
      model: 'black-forest-labs/flux-1.1-pro' as import('../../services/replicate').ReplicateImageModel,
      strength: options?.strength,
      seed: options?.seed,
    }).catch(console.error);
  }, [executeNode]);

  const updateNodeData = useCallback((nodeId: string, newData: Partial<BuilderNodeData>) => {
    setNodes(nds => nds.map(n => 
      n.id === nodeId 
        ? { ...n, data: { ...n.data, ...newData } }
        : n
    ));
  }, [setNodes]);

  // ========================================================================
  // CONNECTION RULES - Validate before connecting
  // ========================================================================

  const validateConnection = useCallback((connection: Connection): boolean => {
    if (!connection.source || !connection.target) return false;
    
    // Prevent circular connections
    const downstream = findDownstreamNodes(connection.target);
    if (downstream.includes(connection.source)) {
      console.error('Circular connection detected');
      return false;
    }

    const sourceNode = getNode(connection.source);
    const targetNode = getNode(connection.target);
    
    if (!sourceNode || !targetNode) return false;

    const sourceData = sourceNode.data as BuilderNodeData;
    const targetData = targetNode.data as BuilderNodeData;

    // Only LEFT → RIGHT flow
    // Source can connect to anything
    // Result can connect to ghosts
    // Ghost cannot be a source
    if (sourceData.type === 'ghost') {
      console.error('Ghost nodes cannot be connection sources');
      return false;
    }

    // Target must be a ghost (for new connections)
    if (targetData.type !== 'ghost') {
      console.error('Can only connect to ghost nodes');
      return false;
    }

    return true;
  }, [getNode, findDownstreamNodes]);

  const onConnect = useCallback((params: Connection) => {
    if (!validateConnection(params)) return;
    
    // Calculate the correct target handle for GhostNode
    const targetNode = getNode(params.target);
    if (targetNode?.data?.type === 'ghost') {
      // Count existing connections to this ghost node
      const existingConnections = edgesRef.current.filter(e => e.target === params.target);
      const nextHandleIndex = existingConnections.length;
      params.targetHandle = `ghost-target-${nextHandleIndex}`;
    }
    
    setEdges(eds => addEdge(params, eds));
  }, [validateConnection, setEdges, getNode]);

  // ========================================================================
  // NODE DELETION - Cascading delete
  // ========================================================================

  const deleteNode = useCallback((nodeId: string, _isRecursive = false): void => {
    if (!_isRecursive) pushHistory(nodesRef.current, edgesRef.current); // snapshot once at top level
    const children = getChildren(nodeId);
    children.forEach(child => deleteNode(child.id, true));
    
    setNodes(nds => nds.filter(n => n.id !== nodeId));
    setEdges(eds => eds.filter(e => e.source !== nodeId && e.target !== nodeId));
    
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
    }
  }, [getChildren, setNodes, setEdges, selectedNodeId, setSelectedNodeId]);

  // ========================================================================
  // AUTO LAYOUT
  // ========================================================================

  const rearrangeNodes = useCallback((): void => {
    if (nodes.length === 0) return;

    const rootNodes = nodes.filter(n => {
      const lineage = (n.data as BuilderNodeData).lineage;
      return !lineage?.parentId;
    });

    if (rootNodes.length === 0) return;

    const layoutedNodes: Node[] = [];
    const MARGIN_Y = 100;

    const getSubtreeHeight = (nodeId: string): number => {
      const children = getChildren(nodeId);
      if (children.length === 0) return VERTICAL_SPACING;
      
      return children.reduce((total, child) => 
        total + getSubtreeHeight(child.id), 0
      );
    };

    const layoutSubtree = (nodeId: string, x: number, startY: number): number => {
      const node = getNode(nodeId);
      if (!node) return startY;

      const children = getChildren(nodeId);
      const subtreeHeight = getSubtreeHeight(nodeId);
      const centerY = startY + subtreeHeight / 2 - VERTICAL_SPACING / 2;

      layoutedNodes.push({
        ...node,
        position: { x, y: centerY }
      });

      let currentChildY = startY;
      children.forEach(child => {
        const childHeight = getSubtreeHeight(child.id);
        layoutSubtree(child.id, x + HORIZONTAL_SPACING, currentChildY);
        currentChildY += childHeight;
      });

      return startY + subtreeHeight;
    };

    let currentY = MARGIN_Y;
    rootNodes.forEach(root => {
      layoutSubtree(root.id, 80, currentY);
      currentY += getSubtreeHeight(root.id) + MARGIN_Y;
    });

    setNodes(layoutedNodes);
  }, [nodes, getChildren, getNode, setNodes]);

  // ========================================================================
  // ACTIVE TARGET - For prompt bar
  // ========================================================================

  const activeTarget = useMemo((): Node | null => {
    // Priority: selected ghost node
    if (selectedNodeId) {
      const selected = getNode(selectedNodeId);
      if (selected) {
        const data = selected.data as BuilderNodeData;
        if (data.type === 'ghost' && data.state === 'idle') {
          return selected;
        }
      }
    }
    
    // Fallback: any idle ghost
    return nodes.find(n => {
      const data = n.data as BuilderNodeData;
      return data.type === 'ghost' && data.state === 'idle';
    }) || null;
  }, [nodes, selectedNodeId, getNode]);

  // ========================================================================
  // STATISTICS
  // ========================================================================

  const workflowStats = useMemo((): WorkflowStats => {
    const stats = {
      sourceNodes: 0,
      ghostNodes: 0,
      resultNodes: 0,
      activeProcessing: 0,
      maxDepth: 0,
      totalBranches: 0
    };

    nodes.forEach(n => {
      const data = n.data as BuilderNodeData;
      const lineage = data.lineage;

      switch (data.type) {
        case 'source': stats.sourceNodes++; break;
        case 'ghost': stats.ghostNodes++; break;
        case 'result': stats.resultNodes++; break;
      }

      if (data.state === 'processing') stats.activeProcessing++;
      if (lineage.generation > stats.maxDepth) stats.maxDepth = lineage.generation;
      if (!lineage.parentId) stats.totalBranches++;
    });

    return {
      totalNodes: nodes.length,
      ...stats
    };
  }, [nodes]);

  // ========================================================================
  // RETURN
  // ========================================================================

  return {
    // Core state
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    
    // Selection
    selectedNodeId,
    setSelectedNodeId,
    
    // Node lifecycle (New API)
    createSourceNode,
    spawnGhostNode,
    executeNode,
    
    // Legacy API compatibility
    addChildNode,
    executeProcessing,
    updateNodeData,
    deleteNode,
    
    // Data flow
    propagateNodeUpdate,
    findDownstreamNodes,
    
    // Queries
    getNode,
    getNodeData,
    getChildren,
    getParent,
    getAllParents,
    
    // Layout
    rearrangeNodes,
    
    // UI helpers
    activeTarget,
    workflowStats,
    
    // Direct setters (for advanced use)
    setNodes,
    setEdges,

    // Restore state — true once localStorage restore attempt is complete
    isRestored,

    // Undo/Redo
    undo,
    redo,
    canUndo,
    canRedo
  };
};
