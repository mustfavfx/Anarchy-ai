/**
 * CanvasBridgeService
 * Central coordinator bridging the Anarchy AI interactive canvas with the
 * autonomous ArchVision AI Agent running on E:\Agent.
 * 
 * Allows bidirectional state sync:
 * - Inspects active canvas node (ID, thumbnail image, prompt, dimensions)
 * - Sends multimodal canvas visual context to the ArchVision agent
 * - Writes optimized architectural prompts and parameters directly back to canvas nodes
 */

import { useAIConfigStore, type SelectedNodeInfo, type CanvasNodeImageSummary } from '../../stores/aiConfigStore';
import { archVisionAgent, type DesignResponse } from './ArchVisionAgentService';
import { autoPromptService } from '../ai/autoPromptService';
import { architectAgent } from './ArchitectAgentService';
import {
  getLocalImage,
  getLocalImageAsObjectURL,
  dataURLtoBlob,
  blobToDataURL,
} from '../../services/history/HistoryService';
import type { CanvasAction, NodeComparisonReport } from './ArchitecturalUnderstanding';
import { canvasContextEngine } from './CanvasContextEngine';
import { hindsightMemory } from './HindsightMemoryService';

export const VISION_SCHEMA_EPOCH = 1790199000000;

export class CanvasBridgeService {
  private static instance: CanvasBridgeService;

  private constructor() {}

  public static getInstance(): CanvasBridgeService {
    if (!CanvasBridgeService.instance) {
      CanvasBridgeService.instance = new CanvasBridgeService();
    }
    return CanvasBridgeService.instance;
  }

  /**
   * Returns current active/selected canvas node information.
   * If selectedNode has no image, falls back to the first available canvas image.
   */
  public getActiveNode(): SelectedNodeInfo {
    const selected = useAIConfigStore.getState().selectedNode;
    if (selected && (selected.image || selected.originalImage || selected.id)) {
      return selected;
    }
    const canvasImages = useAIConfigStore.getState().canvasImages;
    if (canvasImages && canvasImages.length > 0) {
      const first = canvasImages[0];
      return {
        id: first.id,
        type: (first.type as any) || 'source',
        image: first.image,
        originalImage: first.originalImage,
        prompt: first.prompt,
        state: 'ready',
        dimensions: first.dimensions,
      };
    }
    return selected;
  }

  /**
   * Returns all image-bearing nodes currently present on the canvas.
   */
  public getCanvasImages(): CanvasNodeImageSummary[] {
    return useAIConfigStore.getState().canvasImages || [];
  }

  /**
   * Selects a canvas node by its ID and synchronizes store state.
   */
  public setActiveNodeById(nodeId: string): boolean {
    const canvasImages = this.getCanvasImages();
    const target = canvasImages.find((img) => img.id === nodeId);
    if (target) {
      useAIConfigStore.getState().setSelectedNode({
        id: target.id,
        type: (target.type as any) || 'source',
        image: target.image,
        originalImage: target.originalImage,
        prompt: target.prompt,
        state: 'ready',
        dimensions: target.dimensions,
      });
      return true;
    }
    return false;
  }

  /**
   * Checks if a valid canvas node is currently selected or available.
   */
  public hasActiveNode(): boolean {
    const node = this.getActiveNode();
    return !!(node && (node.id || node.image || node.originalImage));
  }

  /**
   * Applies an architectural prompt directly to a specific canvas node
   * and synchronizes the global workspace prompt bar.
   */
  public applyPromptToNode(nodeId: string, prompt: string): void {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    useAIConfigStore.getState().updateNodePrompt(nodeId, trimmed);
  }

  /**
   * Applies an architectural prompt directly to the currently active canvas node.
   * If no node is selected, updates the workspace prompt bar.
   * Returns true if applied to a specific node, false if applied globally.
   */
  public applyPromptToActiveNode(prompt: string): boolean {
    const node = this.getActiveNode();
    const trimmed = prompt.trim();
    if (!trimmed) return false;

    if (node && node.id) {
      this.applyPromptToNode(node.id, trimmed);
      return true;
    }

    useAIConfigStore.getState().setWorkspacePrompt(trimmed);
    return false;
  }

  /**
   * Converts active node's image (idb:// key, base64 data URL, blob: URL or HTTP URL) into a Blob
   * for multimodal agent vision processing.
   */
  public async getActiveNodeImageBlob(): Promise<Blob | null> {
    const node = this.getActiveNode();
    let imageUrl = node?.image || node?.originalImage;
    if (!imageUrl) return null;

    try {
      if (imageUrl.startsWith('idb://')) {
        const objectUrl = await getLocalImageAsObjectURL(imageUrl);
        if (objectUrl) {
          imageUrl = objectUrl;
        } else {
          const dataUrl = await getLocalImage(imageUrl);
          if (dataUrl && dataUrl.startsWith('data:')) {
            return dataURLtoBlob(dataUrl);
          }
        }
      }

      if (imageUrl.startsWith('data:')) {
        return dataURLtoBlob(imageUrl);
      }

      const response = await fetch(imageUrl);
      return await response.blob();
    } catch (err) {
      console.error('[CanvasBridgeService] Failed to convert active node image to Blob:', err);
      return null;
    }
  }

  /**
   * Resolves active node's image into a genuine data:image/...;base64,... string.
   * Ensures the agent vision model receives decoded image pixels rather than internal keys.
   */
  public async getActiveNodeImageBase64(): Promise<string | null> {
    const node = this.getActiveNode();
    const imageUrl = node?.image || node?.originalImage;
    if (!imageUrl) return null;

    try {
      if (imageUrl.startsWith('idb://')) {
        const dataUrl = await getLocalImage(imageUrl);
        if (dataUrl) return dataUrl;
      }

      if (imageUrl.startsWith('data:')) {
        return imageUrl;
      }

      const blob = await this.getActiveNodeImageBlob();
      if (!blob) return null;

      return await blobToDataURL(blob);
    } catch (err) {
      console.error('[CanvasBridgeService] Failed to resolve active node image to base64:', err);
      return null;
    }
  }

  /**
   * Autonomous Agent Optimization:
   * Takes the active canvas node's visual image and current prompt text,
   * sends it through the ArchVision Agent pipeline, and returns the
   * synthesized prompt, zoning compliance, and space matrix.
   */
  public async optimizeActiveNodeWithAgent(options?: {
    userPrompt?: string;
    style?: string;
    typology?: string;
    siteArea?: number;
    targetEngine?: string;
  }): Promise<{
    response: DesignResponse;
    appliedToNode: boolean;
    nodeId: string | null;
  }> {
    const node = this.getActiveNode();
    const userBarPrompt = (options?.userPrompt ?? useAIConfigStore.getState().workspacePrompt ?? '').trim();
    const nodePrompt = (node?.prompt ?? '').trim();

    // Resolve base64 image representation upfront so multimodal agent receives authentic image payload
    const imageBase64 = await this.getActiveNodeImageBase64();
    const hasImage = !!imageBase64;

    // Check connected multi-node graph topology
    const connectedContext = node?.id ? this.getConnectedNodesContext(node.id) : null;
    const hasConnectedIntent = !!(connectedContext && connectedContext.sources.length > 0 && connectedContext.intentSummary);

    // Faithful user-first prompt construction:
    // Prioritizes what the user actually wants / selected without mixing in stale node prompts.
    const semanticCategory = node?.semantic?.category || 'building';
    const isStaleBuildingPrompt = (userBarPrompt || '').includes('Bespoke architectural masterpiece of Analyze');

    let query: string;
    if (userBarPrompt && !isStaleBuildingPrompt) {
      if (hasConnectedIntent && connectedContext.sources.length > 1) {
        query = `${userBarPrompt}. Context from connected nodes: ${connectedContext.intentSummary}`;
      } else {
        query = userBarPrompt;
      }
    } else if (hasConnectedIntent) {
      query = connectedContext.intentSummary;
    } else if (hasImage) {
      if (semanticCategory === 'person') {
        query = 'High-end photorealistic portrait photography, elegant posture and expressions, studio softbox illumination, natural skin texture, 85mm lens, sharp focus';
      } else if (semanticCategory === 'interior') {
        query = 'Refine contemporary interior design with luxury materials, ambient warm lighting, bespoke joinery, architectural perspective';
      } else if (semanticCategory === 'landscape') {
        query = 'Lush architectural landscape and outdoor environment, natural specimen vegetation, atmospheric natural daylight';
      } else if (semanticCategory === 'material') {
        query = 'Ultra-high-resolution architectural material texture, tactile surface detailing, crisp physical displacement';
      } else {
        query = 'Analyze and enhance the architectural building design in this image with ultra-realistic details, materials, and lighting';
      }
    } else if (nodePrompt) {
      query = nodePrompt;
    } else {
      query = '';
    }

    const style = options?.style ?? 'Modern Contemporary';
    const targetEngine = options?.targetEngine ?? 'nano_banana_2';

    let result: DesignResponse;

    try {
      // 1. Ultra-fast direct synthesis (Sub-2s latency via local backend if active)
      result = await archVisionAgent.refineFast({
        user_query: query,
        image_base64: imageBase64 || undefined,
        architectural_style: style,
        target_engine: targetEngine,
      });
    } catch (fastErr) {
      console.warn('[CanvasBridgeService] Fast refine local backend unavailable, trying secondary pipeline:', fastErr);
      try {
        const imageBlob = await this.getActiveNodeImageBlob();
        if (imageBlob) {
          result = await archVisionAgent.designFromImage(imageBlob, 'canvas_node_reference.png', {
            user_query: query,
            site_area_sqm: options?.siteArea ?? 500,
            architectural_style: style,
            target_engine: targetEngine,
            auto_render: false,
          });
        } else {
          result = await archVisionAgent.designFromText({
            user_query: query,
            site_area_sqm: options?.siteArea ?? 500,
            architectural_style: style,
            target_engine: targetEngine,
            auto_render: false,
          });
        }
      } catch (backendErr) {
        console.warn('[CanvasBridgeService] Local E:\\Agent backend offline. Engaging Cloud Architect & Gemini synthesis fallback:', backendErr);
        
        // 2. Seamless Cloud / Gemini / AutoPrompt synthesis fallback
        let synthesizedPrompt = '';
        try {
          const autoPromptRes = await autoPromptService.enhancePrompt(query || 'Modern contemporary architectural villa, photorealistic details');
          synthesizedPrompt = autoPromptRes.enhancedPrompt;
        } catch {
          // try cloud architect
        }

        if (!synthesizedPrompt) {
          try {
            const cloudRes = await architectAgent.generateResponse({
              message: `Create an elite, photorealistic architectural prompt for: ${query || 'contemporary architecture'}. Style: ${style}. Return ONLY the prompt text.`,
              mode: 'prompt',
            });
            synthesizedPrompt = cloudRes.response.trim();
          } catch {
            synthesizedPrompt = `${query || 'Modern contemporary architecture'}, photorealistic architectural visualization, 8k resolution, crisp detailing, natural lighting`;
          }
        }

        result = {
          success: true,
          engine: 'cloud_architect_fallback',
          data: {
            enhanced_prompt: synthesizedPrompt,
            final_summary: 'Architectural prompt synthesized via Cloud Architect & Vision Engine.',
          },
        };
      }
    }

    const enhancedPrompt = result?.data?.enhanced_prompt;
    let appliedToNode = false;

    if (enhancedPrompt) {
      if (node && node.id) {
        this.applyPromptToNode(node.id, enhancedPrompt);
        appliedToNode = true;
      }
      useAIConfigStore.getState().setWorkspacePrompt(enhancedPrompt);
    }

    return {
      response: result,
      appliedToNode,
      nodeId: node?.id || null,
    };
  }

  // ── Multi-Node Scene Graph & Semantic Perception ───────────────────────────

  private classificationCache = new Map<string, any>();
  private inFlightClassifications = new Map<string, Promise<any>>();

  /**
   * Classifies a specific canvas node image into semantic categories.
   * Updates store and caches the result.
   */
  public async classifyCanvasNode(
    nodeId: string,
    force = false,
    explicitImageKey?: string,
    explicitPrompt?: string
  ): Promise<any | null> {
    const images = this.getCanvasImages();
    const target = images.find((img) => img.id === nodeId);
    const activeNode = this.getActiveNode();
    const imageKey = explicitImageKey || target?.image || target?.originalImage || (activeNode?.id === nodeId ? (activeNode?.image || activeNode?.originalImage) : undefined);
    const promptHint = explicitPrompt || target?.prompt || (activeNode?.id === nodeId ? activeNode?.prompt : undefined);

    if (!imageKey) return null;

    // Check memory cache unless force is requested
    if (!force && this.classificationCache.has(imageKey)) {
      const cached = this.classificationCache.get(imageKey)!;
      const isGenericDefault = cached.confidence === 0 ||
        cached.tags?.includes('unverified') ||
        cached.label === 'Architectural Asset' ||
        cached.subTypology === 'Contemporary Residential Villa' ||
        cached.description?.toLowerCase().includes('unverified');
      if (!isGenericDefault && cached.analyzedAt && cached.analyzedAt >= VISION_SCHEMA_EPOCH) {
        useAIConfigStore.getState().updateNodeSemantic(nodeId, cached);
        return cached;
      }
    }

    // Deduplicate in-flight requests for the same image/node
    const inFlightKey = `${nodeId}_${imageKey.slice(0, 80)}`;
    if (this.inFlightClassifications.has(inFlightKey)) {
      return this.inFlightClassifications.get(inFlightKey)!;
    }

    const task = (async () => {
      try {
        // Resolve base64
        let base64: string | null = null;
        if (imageKey.startsWith('data:')) {
          base64 = imageKey;
        } else if (imageKey.startsWith('idb://')) {
          base64 = await getLocalImage(imageKey);
        } else {
          const res = await fetch(imageKey);
          const blob = await res.blob();
          base64 = await blobToDataURL(blob);
        }

        if (!base64) return null;

        const classification = await archVisionAgent.classifyImage(base64, promptHint);
        if (classification) {
          this.classificationCache.set(imageKey, classification);
          useAIConfigStore.getState().updateNodeSemantic(nodeId, classification);
        }
        return classification;
      } catch (err) {
        console.warn(`[CanvasBridgeService] Failed to classify node ${nodeId}:`, err);
        return null;
      } finally {
        this.inFlightClassifications.delete(inFlightKey);
      }
    })();

    this.inFlightClassifications.set(inFlightKey, task);
    return task;
  }

  /**
   * Clears the in-memory semantic classification cache.
   */
  public clearClassificationCache(): void {
    this.classificationCache.clear();
  }

  /**
   * Scans and classifies all image-bearing nodes currently on the canvas.
   */
  public async classifyAllNodes(force = false): Promise<Record<string, any>> {
    const images = this.getCanvasImages();
    const results: Record<string, any> = {};
    for (const img of images) {
      const isFallback = img.semantic && (
        img.semantic.confidence === 0 ||
        img.semantic.tags?.includes('unverified') ||
        img.semantic.label === 'Architectural Asset' ||
        img.semantic.subTypology === 'Contemporary Residential Villa' ||
        img.semantic.description?.toLowerCase().includes('unverified')
      );
      const isStale = !img.semantic || !img.semantic.analyzedAt || img.semantic.analyzedAt < VISION_SCHEMA_EPOCH || isFallback;
      if (img.id && (isStale || force)) {
        const cls = await this.classifyCanvasNode(img.id, true);
        if (cls) results[img.id] = cls;
      } else if (img.id && img.semantic) {
        results[img.id] = img.semantic;
      }
    }
    return results;
  }

  /**
   * Reads graph topology to find what nodes are connected as inputs to a target node.
   * Returns classified roles and summary of user intent.
   */
  public getConnectedNodesContext(targetNodeId: string): {
    sources: Array<{ id: string; semantic?: any; prompt?: string; image?: string }>;
    intentSummary: string;
  } {
    const snapshot = useAIConfigStore.getState().workflowSnapshot;
    const incomingEdges = (snapshot.edges || []).filter((e) => e.target === targetNodeId);
    const sourceNodeIds = incomingEdges.map((e) => e.source);

    const canvasImages = this.getCanvasImages();
    const sources = sourceNodeIds.map((id) => {
      const found = canvasImages.find((img) => img.id === id);
      return {
        id,
        semantic: found?.semantic,
        prompt: found?.prompt,
        image: found?.image || found?.originalImage,
      };
    });

    if (sources.length === 0) {
      return { sources: [], intentSummary: 'Single generation node' };
    }

    if (sources.length === 1) {
      const s = sources[0];
      const category = s.semantic?.category || 'asset';
      return {
        sources,
        intentSummary: `Transforming ${category}: "${s.semantic?.label || s.prompt || 'Source'}"`,
      };
    }

    // Multi-source synthesis (e.g., Person + Interior, Building + Landscape)
    const categories = sources.map((s) => s.semantic?.category || 'asset');
    const hasPerson = categories.includes('person');
    const hasInterior = categories.includes('interior');
    const hasBuilding = categories.includes('building');
    const hasLandscape = categories.includes('landscape');
    const hasMaterial = categories.includes('material');

    let intent = `Synthesizing ${sources.length} visual references`;
    if (hasPerson && hasInterior) {
      intent = 'Placing human subject naturally inside interior architectural space';
    } else if (hasPerson && hasBuilding) {
      intent = 'Integrating human subject seamlessly in front of architectural building';
    } else if (hasBuilding && hasLandscape) {
      intent = 'Blending architectural structure harmoniously into landscape terrain';
    } else if (hasMaterial && (hasBuilding || hasInterior)) {
      intent = 'Applying bespoke texture and material finish onto architectural model';
    }

    return { sources, intentSummary: intent };
  }

  // ── Autonomous Canvas Action Dispatches & Co-Pilot Actuators ───────────────

  /**
   * Focuses the canvas camera smoothly on a target node.
   */
  public focusNode(nodeId: string): boolean {
    if (!nodeId) return false;
    useAIConfigStore.getState().focusNode(nodeId);
    return true;
  }

  /**
   * Forks an existing node into a connected child branch node.
   */
  public async forkNode(
    parentId: string,
    image?: string,
    label?: string,
    prompt?: string
  ): Promise<string | null> {
    const store = useAIConfigStore.getState();
    const effectiveParentId = parentId || store.selectedNode?.id;
    if (!effectiveParentId) return null;

    let targetImage = image;
    if (!targetImage) {
      targetImage = (await this.getActiveNodeImageBase64()) || '';
    }

    const effectivePrompt = prompt || store.selectedNode?.prompt;
    const childId = store.forkChildNode(
      effectiveParentId,
      targetImage,
      label || 'Design Branch',
      effectivePrompt
    );

    if (childId) {
      setTimeout(() => {
        store.focusNode(childId);
      }, 100);
    }

    return childId;
  }

  /**
   * Performs comparative analysis between two nodes on the canvas.
   */
  public async compareCanvasNodes(nodeIdA: string, nodeIdB: string): Promise<NodeComparisonReport> {
    return await canvasContextEngine.compareNodes(nodeIdA, nodeIdB);
  }

  /**
   * Executes an autonomous canvas action dispatched by the AI Agent.
   */
  public async executeCanvasAction(action: CanvasAction): Promise<{
    success: boolean;
    message: string;
    resultNodeId?: string;
    comparison?: NodeComparisonReport;
  }> {
    const store = useAIConfigStore.getState();

    switch (action.type) {
      case 'fork_node': {
        const parentId = action.parentId || action.nodeId || store.selectedNode?.id;
        if (!parentId) {
          return { success: false, message: 'No target parent node specified for branching.' };
        }
        const childId = await this.forkNode(parentId, undefined, action.label, action.prompt);
        if (childId) {
          hindsightMemory.retain({
            category: 'design_decision',
            content: `Architectural branch forked from #${parentId.slice(0, 6)}: ${action.label || 'Design Variation'}. Prompt: "${action.prompt || ''}"`,
            context: {
              nodeId: childId,
              action: 'fork_branch',
            },
            importance: 4,
          }).catch(() => {});

          return {
            success: true,
            message: `Created connected child branch #${childId.slice(0, 6)} from parent #${parentId.slice(0, 6)}.`,
            resultNodeId: childId,
          };
        }
        return { success: false, message: 'Canvas fork function not initialized.' };
      }

      case 'focus_node': {
        const targetId = action.nodeId || store.selectedNode?.id;
        if (targetId) {
          this.focusNode(targetId);
          this.setActiveNodeById(targetId);
          return {
            success: true,
            message: `Focused canvas camera on node #${targetId.slice(0, 6)}.`,
            resultNodeId: targetId,
          };
        }
        return { success: false, message: 'No target node specified to focus.' };
      }

      case 'select_node': {
        const targetId = action.nodeId;
        if (targetId && this.setActiveNodeById(targetId)) {
          this.focusNode(targetId);
          return {
            success: true,
            message: `Selected node #${targetId.slice(0, 6)}.`,
            resultNodeId: targetId,
          };
        }
        return { success: false, message: 'Target node not found.' };
      }

      case 'update_prompt': {
        const targetId = action.nodeId || store.selectedNode?.id;
        if (action.prompt && targetId) {
          this.applyPromptToNode(targetId, action.prompt);
          return {
            success: true,
            message: `Updated prompt on node #${targetId.slice(0, 6)}.`,
            resultNodeId: targetId,
          };
        }
        return { success: false, message: 'Missing node ID or prompt text.' };
      }

      case 'compare_nodes': {
        const idA = action.nodeIdA;
        const idB = action.nodeIdB;
        if (!idA || !idB) {
          return { success: false, message: 'Must provide both nodeIdA and nodeIdB to compare.' };
        }
        const report = await this.compareCanvasNodes(idA, idB);
        return {
          success: true,
          message: `Compared node #${idA.slice(0, 6)} with node #${idB.slice(0, 6)} (Score delta: ${report.visualDiff.realismScoreDelta > 0 ? '+' : ''}${report.visualDiff.realismScoreDelta}).`,
          comparison: report,
        };
      }

      case 'multi_branch': {
        const parentId = action.parentId || action.nodeId || store.selectedNode?.id;
        if (!parentId) {
          return { success: false, message: 'No target parent node specified for multi-branching.' };
        }
        const defaultBranches = [
          {
            label: 'Travertine & Glass',
            materialFocus: 'Natural travertine limestone and low-iron crystal glass',
            prompt: `${action.prompt || 'Architectural redesign'}, honed natural travertine stone panels, expansive floor-to-ceiling curtain glass, champagne aluminum mullions, warm architectural lighting`,
          },
          {
            label: 'Board-Formed Concrete',
            materialFocus: 'Exposed textured architectural concrete',
            prompt: `${action.prompt || 'Architectural redesign'}, tactile board-formed raw concrete walls with visible grain, blackened steel brise-soleil accents, minimalist landscaping`,
          },
          {
            label: 'Modern Salmani Mashrabiya',
            materialFocus: 'Salmani limestone and geometric mashrabiya screens',
            prompt: `${action.prompt || 'Architectural redesign'}, authentic Riyadh limestone cladding, parametric bronze mashrabiya solar screens, recessed shaded openings, water courtyard feature`,
          },
          {
            label: 'Mass Timber & Greenery',
            materialFocus: 'Cross-laminated timber (CLT) & biophilic integration',
            prompt: `${action.prompt || 'Architectural redesign'}, sustainable mass timber structure, slatted cedar cladding, integrated biophilic planter terraces, warm Scandinavian ambient daylight`,
          },
        ];

        const branchesToCreate = (action.branches && action.branches.length > 0) ? action.branches : defaultBranches;
        const createdIds: string[] = [];

        for (const branch of branchesToCreate) {
          const childId = await this.forkNode(parentId, undefined, branch.label, branch.prompt);
          if (childId) {
            createdIds.push(childId);
          }
        }

        if (createdIds.length > 0) {
          if (action.autoExecute) {
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('anarchy:trigger-generate'));
            }, 300);
          }

          hindsightMemory.retain({
            category: 'design_decision',
            content: `Multi-branch architectural study initiated from #${parentId.slice(0, 6)} with ${createdIds.length} material variations: ${branchesToCreate.map(b => b.label).join(', ')}.`,
            context: {
              parentNodeId: parentId,
              childNodeIds: createdIds,
              action: 'multi_branch_orchestration',
            },
            importance: 5,
          }).catch(() => {});

          return {
            success: true,
            message: `Orchestrated ${createdIds.length} architectural design branches (${branchesToCreate.map(b => b.label).join(', ')}).`,
            resultNodeId: createdIds[0],
          };
        }
        return { success: false, message: 'Failed to create multi-branch nodes.' };
      }

      case 'chain_upscale': {
        const targetId = action.nodeId || store.selectedNode?.id;
        if (!targetId) {
          return { success: false, message: 'No target node specified for upscale chaining.' };
        }
        const scale = action.upscaleFactor || 2;
        const prompt = action.prompt || 'Masterpiece 8K architectural render, micro-surface texture enhancement, pristine material clarity';
        const childId = await this.forkNode(targetId, undefined, `Upscale ${scale}x`, prompt);
        if (childId) {
          store.setConfig(prev => ({
            ...prev,
            selectedTool: 'image-upscaler',
            upscaleFactor: scale as any,
          }));
          if (action.autoExecute) {
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('anarchy:trigger-generate'));
            }, 300);
          }
          return {
            success: true,
            message: `Created chained ${scale}x Super-Resolution node #${childId.slice(0, 6)}.`,
            resultNodeId: childId,
          };
        }
        return { success: false, message: 'Failed to create upscale chain node.' };
      }

      default:
        return { success: false, message: `Unknown canvas action type: ${(action as any).type}` };
    }
  }
}

export const canvasBridge = CanvasBridgeService.getInstance();
