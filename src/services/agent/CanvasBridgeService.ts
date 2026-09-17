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

import { useAIConfigStore, type SelectedNodeInfo } from '../../stores/aiConfigStore';
import { archVisionAgent, type DesignResponse } from './ArchVisionAgentService';

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
   */
  public getActiveNode(): SelectedNodeInfo {
    return useAIConfigStore.getState().selectedNode;
  }

  /**
   * Checks if a valid canvas node is currently selected.
   */
  public hasActiveNode(): boolean {
    const node = this.getActiveNode();
    return !!(node && node.id);
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
   * Converts active node's image (base64 data URL or HTTP URL) into a Blob
   * for multimodal agent vision processing.
   */
  public async getActiveNodeImageBlob(): Promise<Blob | null> {
    const node = this.getActiveNode();
    const imageUrl = node?.image || node?.originalImage;
    if (!imageUrl) return null;

    try {
      const response = await fetch(imageUrl);
      return await response.blob();
    } catch (err) {
      console.error('[CanvasBridgeService] Failed to convert active node image to Blob:', err);
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
    const imageUrl = node?.image || node?.originalImage;

    // Faithful user-first prompt construction:
    // Prioritizes what the user actually wants / selected without mixing in stale node prompts.
    let query: string;
    if (userBarPrompt) {
      // User explicitly typed or selected a preset prompt: this is the primary ground truth!
      query = userBarPrompt;
    } else if (imageUrl) {
      // No prompt given, but reference image is active: faithfully describe and enhance the image scene
      query = '';
    } else if (nodePrompt) {
      query = nodePrompt;
    } else {
      query = '';
    }

    const style = options?.style ?? 'Modern Contemporary';
    const targetEngine = options?.targetEngine ?? 'nano_banana_2';

    let result: DesignResponse;

    try {
      // 1. Ultra-fast direct synthesis (Sub-2s latency)
      result = await archVisionAgent.refineFast({
        user_query: query,
        image_base64: imageUrl || undefined,
        architectural_style: style,
        target_engine: targetEngine,
      });
    } catch (fastErr) {
      console.warn('[CanvasBridgeService] Fast refine failed, falling back to standard pipeline:', fastErr);
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
}

export const canvasBridge = CanvasBridgeService.getInstance();
