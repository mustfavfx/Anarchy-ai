import { memo } from 'react';
import { type Node } from '@xyflow/react';
import { logger } from '../../../utils/logger';
import { urlToDataUri } from '../../../services/export';
import { getLocalImage } from '../../../services/history/HistoryService';
import VizGhostAttachEdge from '../VizGhostAttachEdge';
import { BaseNode } from '../BaseNode';
import { GhostNode } from '../GhostNode';

export const SOURCE_LABELS: Record<string, string> = {
  autocad: 'AutoCAD', revit: 'Revit',
  '3dsmax': '3ds Max', max: '3ds Max',
  rhino: 'Rhino', sketchup: 'SketchUp',
};

export function resolveSourceLabel(raw: string): string {
  const lower = raw.toLowerCase();
  return SOURCE_LABELS[lower] ?? (lower ? lower.charAt(0).toUpperCase() + lower.slice(1) : 'External');
}

export const buildGenConfig = (aiConfig: any) => ({
  model: aiConfig.model,
  resolution: aiConfig.resolution,
  aspectRatio: aiConfig.aspectRatio,
  steps: aiConfig.steps,
  cfg: aiConfig.cfg,
  seed: aiConfig.seed,
  strength: aiConfig.strength,
  referenceStrength: aiConfig.referenceStrength,
  negativePrompt: aiConfig.negativePrompt,
  disableSafetyChecker: aiConfig.disableSafetyChecker,
  upscaleFactor: aiConfig.upscaleFactor,
  // Topaz Labs settings
  enhanceModel: aiConfig.enhanceModel,
  topazUpscaleFactor: aiConfig.topazUpscaleFactor,
  topazSubjectDetection: aiConfig.topazSubjectDetection,
  faceEnhancement: aiConfig.faceEnhancement,
  faceEnhancementCreativity: aiConfig.faceEnhancementCreativity,
  faceEnhancementStrength: aiConfig.faceEnhancementStrength,
  // Clarity Upscaler settings
  clarityScale: aiConfig.clarityScale,
  clarityDynamic: aiConfig.clarityDynamic,
  clarityCreativity: aiConfig.clarityCreativity,
  clarityTilingWidth: aiConfig.clarityTilingWidth,
  clarityTilingHeight: aiConfig.clarityTilingHeight,
  claritySdModel: aiConfig.claritySdModel,
  clarityScheduler: aiConfig.clarityScheduler,
  claritySteps: aiConfig.claritySteps,
  claritySeed: aiConfig.claritySeed,
  clarityDownscaling: aiConfig.clarityDownscaling,
  clarityDownscalingRes: aiConfig.clarityDownscalingRes,
  claritySharpen: aiConfig.claritySharpen,
  clarityHandfix: aiConfig.clarityHandfix,
  clarityPattern: aiConfig.clarityPattern,
  clarityResemblance: aiConfig.clarityResemblance,
  clarityOutputFormat: aiConfig.clarityOutputFormat,
  // Pruna AI settings
  prunaMode: aiConfig.prunaMode,
  prunaTarget: aiConfig.prunaTarget,
  prunaFactor: aiConfig.prunaFactor,
  prunaEnhanceDetails: aiConfig.prunaEnhanceDetails,
  prunaEnhanceRealism: aiConfig.prunaEnhanceRealism,
  prunaQuality: aiConfig.prunaQuality,
  prunaOutputFormat: aiConfig.prunaOutputFormat,
});

export function convertNodeTreeToWorkflow(nodeTree: any): { nodes: any[]; edges: any[] } {
  const TYPE_LABELS: Record<string, string> = {
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

  const nodesRaw = nodeTree.nodes || [];

  const getLineage = (node: any): { generation: number; ancestry: string[]; branchIndex: number } => {
    const ancestry: string[] = [];
    let curr = node;
    while (curr && curr.parentId) {
      ancestry.unshift(curr.parentId);
      curr = nodesRaw.find((x: any) => x.id === curr.parentId);
    }
    const generation = ancestry.length;
    
    // Find siblings (other nodes with the same parentId)
    const siblings = nodesRaw.filter((x: any) => x.parentId === node.parentId);
    // Sort siblings by ID to ensure stable branchIndex calculation
    siblings.sort((a: any, b: any) => String(a.id).localeCompare(String(b.id)));
    const branchIndex = siblings.findIndex((x: any) => x.id === node.id);
    
    return {
      generation,
      ancestry,
      branchIndex: branchIndex >= 0 ? branchIndex : 0
    };
  };

  const nodes = nodesRaw.map((n: any) => {
    const rfType = n.type === 'ghost' ? 'ghostNode' : 'baseNode';
    const { generation, ancestry, branchIndex } = getLineage(n);
    
    const lineage = {
      parentId: n.parentId || null,
      rootSourceId: nodeTree.sourceNodeId || ancestry[0] || n.id,
      generation,
      branchIndex,
      processingType: n.processingType || 'source',
      ancestry
    };

    const outputPacket = n.image ? {
      image: n.image,
      prompt: n.prompt,
      metadata: {
        timestamp: nodeTree.createdAt || Date.now(),
        operationType: n.processingType || 'source',
        format: 'png'
      }
    } : undefined;

    return {
      id: n.id,
      type: rfType,
      position: n.position || { x: 200, y: 200 },
      width: 260,
      data: {
        label: TYPE_LABELS[n.processingType || ''] || n.processingType || 'Node',
        type: n.type,
        processingType: n.processingType || 'source',
        state: n.state || 'ready',
        image: n.image,
        prompt: n.prompt,
        createdAt: nodeTree.createdAt || Date.now(),
        lineage,
        outputData: outputPacket,
        inputData: undefined,
        config: {}
      }
    };
  });

  const edges: any[] = [];
  (nodeTree.nodes || []).forEach((n: any) => {
    if (n.parentId) {
      edges.push({
        id: `e-${n.parentId}-${n.id}-0`,
        source: n.parentId,
        target: n.id,
        sourceHandle: 'source',
        targetHandle: 'ghost-target-0',
        type: 'default',
        animated: false,
        label: null,
        style: { 
          strokeWidth: 2,
          stroke: '#e11d48',
          opacity: 0.8,
          strokeDasharray: '5 5',
          strokeLinecap: 'round'
        },
        data: {
          isActive: true,
          lastUpdate: nodeTree.createdAt || Date.now()
        }
      });
    }
  });

  // Link parent's outputData to inputData of children
  nodes.forEach((node: any) => {
    if (node.data.lineage.parentId) {
      const parent = nodes.find((p: any) => p.id === node.data.lineage.parentId);
      if (parent) {
        node.data.inputData = parent.data.outputData;
      }
    }
  });

  return { nodes, edges };
}

export function drawNodeImage(
  img: HTMLImageElement, nodeRect: DOMRect, rect: DOMRect,
  ctx: CanvasRenderingContext2D, res: () => void
) {
  try {
    ctx.drawImage(img, nodeRect.left - rect.left, nodeRect.top - rect.top, nodeRect.width, nodeRect.height);
  } catch (err) {
    logger.warn('[Thumbnail] Failed to draw image:', err);
  }
  res();
}

export function makeNodeImagePromise(
  img: HTMLImageElement, nodeRect: DOMRect, rect: DOMRect, ctx: CanvasRenderingContext2D
): Promise<void> {
  return new Promise<void>((res) => {
    const draw = () => drawNodeImage(img, nodeRect, rect, ctx, res);
    if (img.complete) { draw(); return; }
    img.onload = draw;
    img.onerror = () => { logger.warn('[Thumbnail] Image failed to load'); res(); };
    setTimeout(() => { if (!img.complete) { logger.warn('[Thumbnail] Image load timeout'); res(); } }, 2000);
  });
}

export function htmlToCanvas(element: HTMLElement): Promise<HTMLCanvasElement | null> {
  return new Promise((resolve) => {
    try {
      const rect = element.getBoundingClientRect();
      const canvas = document.createElement('canvas');
      canvas.width = rect.width;
      canvas.height = rect.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(null); return; }
      ctx.fillStyle = '#0f0f0f';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const nodeEls = element.querySelectorAll('.react-flow__node');
      const promises: Promise<void>[] = [];
      nodeEls.forEach((node) => {
        const htmlNode = node as HTMLElement;
        const nodeRect = htmlNode.getBoundingClientRect();
        const img = htmlNode.querySelector('img');
        if (img) promises.push(makeNodeImagePromise(img, nodeRect, rect, ctx));
      });
      Promise.all(promises).then(() => resolve(canvas));
    } catch { resolve(null); }
  });
}

export function makeSourceOutput(url: string) {
  if (!url) return undefined;
  return { image: url, prompt: undefined, metadata: { timestamp: Date.now(), operationType: 'source' as const } };
}

export function isValidPosition(node: Node): boolean {
  const p = node.position;
  if (!p) return false;
  if (typeof p.x !== 'number' || Number.isNaN(p.x)) return false;
  if (typeof p.y !== 'number' || Number.isNaN(p.y)) return false;
  return true;
}

export function positionExtraNode<T extends Node>(sourceId: string, baseX: number, baseY: number, index: number) {
  return (curr: T[]) => curr.map(n =>
    n.id === sourceId ? { ...n, position: { x: baseX, y: baseY + 170 * (index + 1) } } as T : n
  );
}

export function positionExternalNode<T extends Node>(sourceId: string) {
  return (curr: T[]) => {
    const otherSources = curr.filter(s => s.id !== sourceId && (s.data as any)?.type === 'source').length;
    return curr.map(n =>
      n.id === sourceId
        ? { ...n, position: { x: 120, y: 260 + otherSources * 40 } } as T
        : n
    );
  };
}

export function patchNodeImage<T extends Node>(sourceNodeId: string, img: string) {
  return (curr: T[]) => curr.map(n =>
    n.id === sourceNodeId ? { ...n, data: { ...n.data, image: img, state: 'ready' } } as T : n
  );
}

export function patchSpawnedNode<T extends Node>(nodeId: string) {
  return (curr: T[]) => {
    const otherSources = curr.filter(s => s.id !== nodeId && (s.data as any)?.type === 'source').length;
    return curr.map(n =>
      n.id === nodeId
        ? { ...n, position: { x: 120, y: 200 + otherSources * 80 } } as T
        : n
    );
  };
}

export async function resolveImageUrl(imageUrl: string): Promise<string> {
  if (!imageUrl) return imageUrl;
  let resolved = imageUrl;
  if (imageUrl.startsWith('idb://')) {
    const cached = await getLocalImage(imageUrl);
    if (!cached) throw new Error('Could not retrieve image from local database');
    resolved = cached;
  }
  if (!resolved.startsWith('data:')) {
    resolved = await urlToDataUri(resolved);
  }
  return resolved;
}

export const nodeTypes = {
  baseNode: BaseNode,
  ghostNode: GhostNode,
};

export const edgeTypes = {
  default: VizGhostAttachEdge,
};

export const CustomConnectionLine = memo(({ fromX, fromY, toX, toY }: { fromX: number; fromY: number; toX: number; toY: number }) => {
  const path = `M ${fromX} ${fromY} L ${toX} ${toY}`;
  return (
    <g>
      <path
        d={path}
        stroke="#e11d48"
        strokeWidth={2}
        strokeDasharray="5 5"
        fill="none"
        style={{ pointerEvents: 'none' }}
      />
    </g>
  );
});

CustomConnectionLine.displayName = 'CustomConnectionLine';
