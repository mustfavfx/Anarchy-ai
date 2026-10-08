/**
 * Canvas Context Engine
 * 
 * Provides an autonomous, live graph awareness layer for the AI Agent.
 * Traverses React Flow graph topology, resolves node lineages, extracts parameters,
 * and performs multi-dimensional visual and prompt comparisons.
 * 
 * Inspired by jianzhou0420/AgentCanvas & AECFoundry/AECV-Bench.
 */

import { useAIConfigStore } from '../../stores/aiConfigStore';
import { getLocalImage, getLocalImageAsObjectURL } from '../history/HistoryService';
import type { 
  NodeContext, 
  CanvasGraphSnapshot, 
  NodeComparisonReport, 
  StructuredArchitecturalAnalysis,
  NodeContextL0,
  NodeContextL1,
  NodeContextL2,
  AgentArchitecturalMemory,
} from './ArchitecturalUnderstanding';
import type { SemanticCategory } from '../../features/builder/types';
import { archVisionAgent } from './ArchVisionAgentService';

class CanvasContextEngine {
  private analysisCache = new Map<string, StructuredArchitecturalAnalysis>();

  /**
   * Returns full NodeContext for the currently selected canvas node.
   */
  public getSelectedNode(): NodeContext | null {
    const store = useAIConfigStore.getState();
    const sel = store.selectedNode;
    if (!sel || !sel.id) return null;
    return this.getNode(sel.id);
  }

  /**
   * Retrieves a specific node by ID and builds its rich NodeContext.
   */
  public getNode(id: string): NodeContext | null {
    const { workflowSnapshot, canvasImages, selectedNode } = useAIConfigStore.getState();
    const node = (workflowSnapshot.nodes || []).find((n) => n.id === id);
    const canvasImg = (canvasImages || []).find((ci) => ci.id === id);

    if (!node && !canvasImg && selectedNode.id !== id) return null;

    const nodeData = (node?.data || {}) as Record<string, any>;
    const edges = workflowSnapshot.edges || [];

    // Incoming edges -> parent nodes
    const parentNodes = edges
      .filter((e) => e.target === id)
      .map((e) => e.source);

    // Outgoing edges -> child nodes
    const childNodes = edges
      .filter((e) => e.source === id)
      .map((e) => e.target);

    // Resolve images
    const image = nodeData.image || nodeData.outputData?.image || canvasImg?.image || (selectedNode.id === id ? selectedNode.image : undefined);
    const originalImage = nodeData.originalImage || canvasImg?.originalImage || (selectedNode.id === id ? selectedNode.originalImage : undefined);
    const prompt = nodeData.prompt || canvasImg?.prompt || (selectedNode.id === id ? selectedNode.prompt : undefined);
    const label = nodeData.label || canvasImg?.label || node?.id;
    const type = (nodeData.type || node?.type || canvasImg?.type || 'result') as NodeContext['type'];
    const model = nodeData.model || nodeData.engine || nodeData.selectedEngine;
    const parameters = nodeData.parameters || nodeData.config || nodeData.outputData?.parameters;
    const analysis = (nodeData.structuredAnalysis || (image && this.analysisCache.get(image))) as StructuredArchitecturalAnalysis | undefined;

    // Trace lineage: root ancestor node
    const generatedFrom = this.traceRootAncestor(id, edges);

    return {
      id,
      label,
      type,
      image,
      originalImage,
      prompt,
      model,
      parameters,
      parentNodes,
      childNodes,
      generatedFrom,
      analysis,
    };
  }

  /**
   * Resolves the base64 or object URL of a node's image.
   */
  public async getNodeImage(id: string): Promise<string | null> {
    const node = this.getNode(id);
    const raw = node?.image || node?.originalImage;
    if (!raw) return null;

    if (raw.startsWith('idb://')) {
      const objUrl = await getLocalImageAsObjectURL(raw);
      if (objUrl) return objUrl;
      const b64 = await getLocalImage(raw);
      return b64 || null;
    }
    return raw;
  }

  /**
   * Returns the prompt configured for a node.
   */
  public getNodePrompt(id: string): string {
    const node = this.getNode(id);
    return (node?.prompt || '').trim();
  }

  /**
   * Returns all direct parent nodes supplying input to the given node.
   */
  public getParentNodes(id: string): NodeContext[] {
    const node = this.getNode(id);
    if (!node) return [];
    return node.parentNodes
      .map((pid) => this.getNode(pid))
      .filter((n): n is NodeContext => n !== null);
  }

  /**
   * Returns all downstream child nodes receiving output from this node.
   */
  public getChildNodes(id: string): NodeContext[] {
    const node = this.getNode(id);
    if (!node) return [];
    return node.childNodes
      .map((cid) => this.getNode(cid))
      .filter((n): n is NodeContext => n !== null);
  }

  /**
   * Produces a complete topological snapshot of the entire canvas.
   */
  public getCanvasGraph(): CanvasGraphSnapshot {
    const { workflowSnapshot, canvasImages } = useAIConfigStore.getState();
    const nodes = (workflowSnapshot.nodes || []).map((n) => this.getNode(n.id)).filter((n): n is NodeContext => n !== null);
    const edges = (workflowSnapshot.edges || []).map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle || undefined,
      targetHandle: e.targetHandle || undefined,
    }));

    const lineages: Record<string, string[]> = {};
    for (const node of nodes) {
      lineages[node.id] = this.traceAncestorsChain(node.id, workflowSnapshot.edges || []);
    }

    return {
      nodesCount: nodes.length,
      imageNodesCount: canvasImages.length,
      nodes,
      edges,
      lineages,
    };
  }

  /**
   * Performs structured multimodal analysis on a specific node's image.
   */
  public async analyzeNodeWithBrain(id: string): Promise<StructuredArchitecturalAnalysis | null> {
    const node = this.getNode(id);
    if (!node) return null;

    const rawImage = node.image || node.originalImage;
    if (!rawImage) return null;

    // Check memory cache
    if (this.analysisCache.has(rawImage)) {
      return this.analysisCache.get(rawImage)!;
    }

    // Convert to base64
    let base64 = rawImage;
    if (rawImage.startsWith('idb://')) {
      const b64 = await getLocalImage(rawImage);
      if (b64) base64 = b64;
    }

    try {
      const analysis = await archVisionAgent.analyzeStructuredArchitecture(base64, node.prompt);
      this.analysisCache.set(rawImage, analysis);

      // Save to store so node data reflects this analysis
      useAIConfigStore.getState().updateNodeSemantic(id, {
        category: analysis.category,
        label: analysis.subTypology,
        confidence: analysis.critique.overallScore / 100,
        tags: analysis.tags,
        description: analysis.description,
        architecturalStyle: analysis.architecturalStyle,
        lightingCondition: analysis.lighting.timeOfDay,
        analyzedAt: analysis.analyzedAt || Date.now(),
      });

      return analysis;
    } catch (err) {
      console.warn(`[CanvasContextEngine] Failed deep analysis for node ${id}:`, err);
      return null;
    }
  }

  /**
   * Deep comparative inspection between two nodes (Node A vs Node B).
   * Analyzes prompt diff, parameter drift, and visual quality metrics.
   */
  public async compareNodes(idA: string, idB: string): Promise<NodeComparisonReport> {
    const nodeA = this.getNode(idA);
    const nodeB = this.getNode(idB);

    if (!nodeA || !nodeB) {
      throw new Error(`Cannot compare nodes: Node ${!nodeA ? idA : idB} does not exist`);
    }

    // 1. Run deep architectural analysis on both nodes
    const [analysisA, analysisB] = await Promise.all([
      nodeA.analysis ? Promise.resolve(nodeA.analysis) : this.analyzeNodeWithBrain(idA),
      nodeB.analysis ? Promise.resolve(nodeB.analysis) : this.analyzeNodeWithBrain(idB),
    ]);

    // 2. Compute prompt diff
    const promptTokensA = (nodeA.prompt || '').toLowerCase().split(/[\s,.;]+/).filter((t) => t.length > 2);
    const promptTokensB = (nodeB.prompt || '').toLowerCase().split(/[\s,.;]+/).filter((t) => t.length > 2);
    const setA = new Set(promptTokensA);
    const setB = new Set(promptTokensB);

    const addedKeywords = promptTokensB.filter((t) => !setA.has(t));
    const removedKeywords = promptTokensA.filter((t) => !setB.has(t));

    // 3. Compute parameter diff
    const paramsA = nodeA.parameters || {};
    const paramsB = nodeB.parameters || {};
    const changedParams: string[] = [];

    const allParamKeys = Array.from(new Set([...Object.keys(paramsA), ...Object.keys(paramsB)]));
    for (const key of allParamKeys) {
      if (paramsA[key] !== paramsB[key]) {
        changedParams.push(`${key}: ${JSON.stringify(paramsA[key])} → ${JSON.stringify(paramsB[key])}`);
      }
    }

    // 4. Visual diff & AEC Score delta
    const scoreA = analysisA?.critique?.overallScore;
    const scoreB = analysisB?.critique?.overallScore;
    const hasScores = typeof scoreA === 'number' && typeof scoreB === 'number' && scoreA > 0 && scoreB > 0;
    const realismDelta = hasScores ? scoreB - scoreA : 0;

    let diagnosisVerdict: NodeComparisonReport['diagnosisVerdict'] = 'inconclusive';
    if (hasScores) {
      if (realismDelta > 7) {
        diagnosisVerdict = 'improved';
      } else if (realismDelta < -7) {
        diagnosisVerdict = 'regressed';
      } else {
        diagnosisVerdict = 'stylistic-variation';
      }
    } else {
      diagnosisVerdict = 'inconclusive';
    }

    // 5. Synthesize architectural explanation
    const compChange = analysisA && analysisB 
      ? `From ${analysisA.composition.framing} with ${analysisA.composition.massing} to ${analysisB.composition.framing} with ${analysisB.composition.massing}`
      : 'Visual composition underwent variation';

    const matChange = analysisA && analysisB
      ? `Materials shifted from ${analysisA.materials.map((m) => m.name).join(', ') || 'default'} to ${analysisB.materials.map((m) => m.name).join(', ') || 'default'}`
      : 'Material textures varied';

    const lightChange = analysisA && analysisB
      ? `Lighting altered from ${analysisA.lighting.timeOfDay} (${analysisA.lighting.source}) to ${analysisB.lighting.timeOfDay} (${analysisB.lighting.source})`
      : 'Lighting condition varied';

    const recommendations: string[] = [];
    if (removedKeywords.length > 0) {
      recommendations.push(`Restore critical descriptors that were dropped: "${removedKeywords.slice(0, 4).join(', ')}"`);
    }
    if (analysisB?.critique.weaknesses && analysisB.critique.weaknesses.length > 0) {
      recommendations.push(...analysisB.critique.weaknesses.map((w) => `Address: ${w}`));
    }
    if (recommendations.length === 0) {
      recommendations.push('Refine lighting contrast and material specular reflections in prompt');
    }

    const expertExplanation = this.formatComparisonExplanation({
      labelA: nodeA.label || idA,
      labelB: nodeB.label || idB,
      verdict: diagnosisVerdict,
      realismDelta,
      addedKeywords,
      removedKeywords,
      changedParams,
      analysisA,
      analysisB,
    });

    return {
      nodeA: { id: idA, label: nodeA.label, prompt: nodeA.prompt, image: nodeA.image, score: scoreA },
      nodeB: { id: idB, label: nodeB.label, prompt: nodeB.prompt, image: nodeB.image, score: scoreB },
      promptDiff: { addedKeywords, removedKeywords },
      parameterDiff: {
        modelDiff: { a: nodeA.model, b: nodeB.model },
        changedParams,
      },
      visualDiff: {
        compositionChange: compChange,
        materialChange: matChange,
        lightingChange: lightChange,
        realismScoreDelta: realismDelta,
      },
      diagnosisVerdict,
      expertExplanation,
      actionableRecommendations: recommendations,
    };
  }

  /**
   * Helper to format an architectural critique explaining differences between two nodes.
   */
  private formatComparisonExplanation(params: {
    labelA: string;
    labelB: string;
    verdict: string;
    realismDelta: number;
    addedKeywords: string[];
    removedKeywords: string[];
    changedParams: string[];
    analysisA?: StructuredArchitecturalAnalysis | null;
    analysisB?: StructuredArchitecturalAnalysis | null;
  }): string {
    const { labelA, labelB, verdict, realismDelta, addedKeywords, removedKeywords, analysisA, analysisB } = params;

    const direction = verdict === 'regressed' 
      ? `النتيجة في [${labelB}] تراجعت مقارنة بـ [${labelA}] (فارق تقييم ${realismDelta} نقطة)`
      : verdict === 'improved'
        ? `النتيجة في [${labelB}] حققت تحسناً ملحوظاً عن [${labelA}] (+${realismDelta} نقطة)`
        : `النتيجة في [${labelB}] تعتبر تنويعاً بصرياً (Variation) عن [${labelA}]`;

    const reasons: string[] = [];

    if (removedKeywords.length > 0) {
      reasons.push(`حذف كلمات مفتاحية معمارية مؤثرة: (${removedKeywords.slice(0, 3).join('، ')}) أدى لفقدان تماسك الكتل أو دقة المواد.`);
    }

    if (addedKeywords.length > 0) {
      reasons.push(`إضافة موجهات جديدة: (${addedKeywords.slice(0, 3).join('، ')}) أثرت على توازن المشهد.`);
    }

    if (analysisA && analysisB) {
      if (analysisA.lighting.timeOfDay !== analysisB.lighting.timeOfDay) {
        reasons.push(`تحول الإضاءة من (${analysisA.lighting.timeOfDay}) إلى (${analysisB.lighting.timeOfDay}) أثر على وضوح الظلال.`);
      }
      if (analysisB.critique.weaknesses.length > 0) {
        reasons.push(`نقاط الضعف المكتشفة: ${analysisB.critique.weaknesses[0]}`);
      }
    }

    return `${direction}.\n` + reasons.map((r, i) => `${i + 1}. ${r}`).join('\n');
  }

  /**
   * Builds an architectural graph context summary string for inclusion in agent reasoning.
   * Provides deep graph topology awareness: active selection, lineage branches, renders, and inputs/outputs.
   */
  public getCanvasSummaryForAgent(): string {
    const graph = this.getCanvasGraph();
    if (graph.nodesCount === 0) return 'Canvas is currently empty.';

    const store = useAIConfigStore.getState();
    const activeSelectedId = store.selectedNode?.id;
    const rawNodes = store.workflowSnapshot.nodes || [];

    const lines: string[] = [
      `Active Canvas Graph contains ${graph.nodesCount} nodes (${graph.imageNodesCount} with visual renders):`,
    ];

    let branchesCount = 0;

    for (const n of graph.nodes) {
      const rawNode = rawNodes.find((rn) => rn.id === n.id);
      const nodeData = (rawNode?.data || {}) as Record<string, any>;
      const isSelected = n.id === activeSelectedId ? ' ★ [ACTIVE/SELECTED]' : '';
      
      const lineage = nodeData.lineage;
      let branchTag = '';
      if (lineage?.parentId) {
        branchesCount++;
        branchTag = ` 🌿[Branch v${lineage.generation || 1} from #${lineage.parentId.slice(0, 6)}]`;
      }

      const category = nodeData.semantic?.category || n.analysis?.category || 'architecture';
      const style = nodeData.semantic?.architecturalStyle || n.analysis?.architecturalStyle || '';
      const styleTag = style ? ` (${style})` : '';

      const hasVisual = Boolean(n.image || n.originalImage || nodeData.image || nodeData.outputData?.image);
      const renderStatus = hasVisual ? '🖼️ [Rendered]' : '📄 [Draft]';

      const promptSnippet = n.prompt 
        ? ` - Prompt: "${n.prompt.slice(0, 80)}${n.prompt.length > 80 ? '...' : ''}"` 
        : ' - (No prompt)';
        
      const inputs = n.parentNodes.length > 0 
        ? ` (Inputs: ${n.parentNodes.map((p) => '#' + p.slice(0, 6)).join(', ')})` 
        : '';

      const children = n.childNodes.length > 0
        ? ` (Children: ${n.childNodes.map((c) => '#' + c.slice(0, 6)).join(', ')})`
        : '';

      lines.push(
        `• Node #${n.id.slice(0, 6)} (id: "${n.id}")${isSelected}${branchTag} [${category.toUpperCase()}${styleTag}] ${renderStatus}${inputs}${children}${promptSnippet}`
      );
    }

    if (branchesCount > 0) {
      lines.push(`Total Design Iteration Branches: ${branchesCount} branch nodes linked in family trees.`);
    }

    return lines.join('\n');
  }

  // ── Helper lineage traversal ───────────────────────────────────────────────

  private traceAncestorsChain(nodeId: string, edges: Array<{ source: string; target: string }>): string[] {
    const ancestors: string[] = [];
    const queue = [nodeId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (visited.has(curr)) continue;
      visited.add(curr);

      const incoming = edges.filter((e) => e.target === curr).map((e) => e.source);
      for (const parent of incoming) {
        if (!visited.has(parent)) {
          ancestors.push(parent);
          queue.push(parent);
        }
      }
    }
    return ancestors;
  }

  private traceRootAncestor(nodeId: string, edges: Array<{ source: string; target: string }>): string | undefined {
    const chain = this.traceAncestorsChain(nodeId, edges);
    return chain.length > 0 ? chain[chain.length - 1] : undefined;
  }

  // ── OpenViking Layered Context Loading (L0 / L1 / L2) ────────────────────────

  /**
   * L0 Context: Ultra-compact node representation (~15 tokens).
   */
  public getNodeL0(id: string): NodeContextL0 | null {
    const node = this.getNode(id);
    if (!node) return null;
    const { workflowSnapshot } = useAIConfigStore.getState();
    const nodeData = (workflowSnapshot.nodes?.find((n) => n.id === id)?.data || {}) as Record<string, any>;
    const category = (nodeData.semantic?.category || (node.analysis?.category) || 'unknown') as SemanticCategory;

    return {
      id: node.id,
      label: node.label,
      category,
      type: node.type,
      hasImage: Boolean(node.image || node.originalImage),
      parentCount: node.parentNodes.length,
      childCount: node.childNodes.length,
      uri: `canvas://nodes/${id}/L0`,
    };
  }

  /**
   * L1 Context: Overview with prompt, model, parameters, and lineage (~70 tokens).
   */
  public getNodeL1(id: string): NodeContextL1 | null {
    const l0 = this.getNodeL0(id);
    const node = this.getNode(id);
    if (!l0 || !node) return null;

    return {
      ...l0,
      uri: `canvas://nodes/${id}/L1`,
      prompt: node.prompt,
      model: node.model,
      parameters: node.parameters,
      parentNodes: node.parentNodes,
      childNodes: node.childNodes,
      generatedFrom: node.generatedFrom,
    };
  }

  /**
   * L2 Context: Full deep multimodal context with architectural critique and materials (~400 tokens).
   */
  public async getNodeL2(id: string): Promise<NodeContextL2 | null> {
    const l1 = this.getNodeL1(id);
    const node = this.getNode(id);
    if (!l1 || !node) return null;

    let analysis = node.analysis;
    if (!analysis && (node.image || node.originalImage)) {
      analysis = (await this.analyzeNodeWithBrain(id)) || undefined;
    }

    return {
      ...l1,
      uri: `canvas://nodes/${id}/L2`,
      analysis,
      rawImageKey: node.image || node.originalImage,
    };
  }

  /**
   * Returns L0 summaries for all nodes on the canvas.
   * Ideal for zero-shot canvas awareness at minimal token cost.
   */
  public getAllNodesL0(): NodeContextL0[] {
    const { workflowSnapshot } = useAIConfigStore.getState();
    return (workflowSnapshot.nodes || [])
      .map((n) => this.getNodeL0(n.id))
      .filter((l0): l0 is NodeContextL0 => l0 !== null);
  }

  // ── OpenViking Virtual Filesystem Explorer (canvas://) ──────────────────────

  /**
   * Lists contents of a canvas:// path.
   * e.g. ls('canvas://') -> ['nodes', 'lineages', 'memory', 'active']
   */
  public async ls(uri = 'canvas://'): Promise<string[]> {
    const clean = uri.replace(/^canvas:\/\/?/, '').replace(/\/$/, '');
    const parts = clean ? clean.split('/') : [];

    if (parts.length === 0) {
      return ['nodes', 'lineages', 'memory', 'active'];
    }

    if (parts[0] === 'nodes') {
      if (parts.length === 1) {
        const { workflowSnapshot } = useAIConfigStore.getState();
        return (workflowSnapshot.nodes || []).map((n) => n.id);
      }
      if (parts.length === 2) {
        return ['L0', 'L1', 'L2', 'prompt', 'image', 'lineage'];
      }
    }

    if (parts[0] === 'memory') {
      return ['preferences', 'session_notes', 'stats'];
    }

    if (parts[0] === 'active') {
      const sel = this.getSelectedNode();
      return sel ? [sel.id] : [];
    }

    return [];
  }

  /**
   * Reads a canvas:// URI resource.
   */
  public async cat(uri: string): Promise<any> {
    const clean = uri.replace(/^canvas:\/\/?/, '').replace(/\/$/, '');
    const parts = clean.split('/');

    if (parts[0] === 'memory') {
      const mem = this.getArchitecturalMemory();
      if (parts[1] === 'preferences') {
        return {
          preferredStyles: mem.preferredStyles,
          preferredMaterials: mem.preferredMaterials,
          preferredLighting: mem.preferredLighting,
          dislikedElements: mem.dislikedElements,
        };
      }
      return mem;
    }

    if (parts[0] === 'nodes' && parts[1]) {
      const nodeId = parts[1];
      const target = parts[2] || 'L1';

      if (target === 'L0') return this.getNodeL0(nodeId);
      if (target === 'L1') return this.getNodeL1(nodeId);
      if (target === 'L2') return this.getNodeL2(nodeId);
      if (target === 'prompt') return this.getNodePrompt(nodeId);
      if (target === 'image') return this.getNodeImage(nodeId);
      if (target === 'lineage') {
        const node = this.getNode(nodeId);
        return {
          parents: node?.parentNodes || [],
          children: node?.childNodes || [],
          root: node?.generatedFrom,
        };
      }
    }

    if (parts[0] === 'active') {
      const sel = this.getSelectedNode();
      return sel ? this.getNodeL1(sel.id) : null;
    }

    return null;
  }

  /**
   * Finds canvas nodes matching specific category or text query.
   */
  public find(filter: { category?: SemanticCategory; query?: string }): NodeContextL0[] {
    const all = this.getAllNodesL0();
    return all.filter((n) => {
      if (filter.category && n.category !== filter.category) return false;
      if (filter.query) {
        const q = filter.query.toLowerCase();
        const l1 = this.getNodeL1(n.id);
        const matchLabel = (n.label || '').toLowerCase().includes(q);
        const matchPrompt = (l1?.prompt || '').toLowerCase().includes(q);
        return matchLabel || matchPrompt;
      }
      return true;
    });
  }

  // ── OpenViking Self-Evolving Architectural Memory ────────────────────────────

  private memoryStorageKey = 'anarchy_agent_viking_memory';

  /**
   * Retrieves the current evolved architectural memory.
   */
  public getArchitecturalMemory(): AgentArchitecturalMemory {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(this.memoryStorageKey);
        if (raw) {
          return JSON.parse(raw);
        }
      }
    } catch {
      // Fallback
    }

    return {
      preferredStyles: ['Contemporary Minimalist', 'Modern Villa'],
      preferredMaterials: ['Natural Travertine', 'Architectural Concrete', 'Tinted Low-E Glazing'],
      preferredLighting: ['Warm Golden-Hour 3200K', 'Crisp Daylight with Soft Volumetric Rays'],
      dislikedElements: ['Harsh neon oversaturation', 'Distorted non-orthogonal facades'],
      typicalAspectRatio: '1:1',
      preferredEngine: 'Nano Banana 2',
      sessionNotes: [],
      updatedAt: Date.now(),
      evolutionCycles: 1,
    };
  }

  /**
   * Saves updated architectural memory to persistent storage.
   */
  public saveArchitecturalMemory(mem: AgentArchitecturalMemory): void {
    try {
      if (typeof localStorage !== 'undefined') {
        mem.updatedAt = Date.now();
        localStorage.setItem(this.memoryStorageKey, JSON.stringify(mem));
      }
    } catch {
      // Ignore
    }
  }

  /**
   * Automatically evolves the agent's memory based on user feedback on a node.
   */
  public evolveMemoryWithFeedback(
    nodeId: string,
    action: 'approved' | 'rejected' | 'refined',
    userNotes?: string
  ): void {
    const mem = this.getArchitecturalMemory();
    const node = this.getNode(nodeId);
    if (!node) return;

    mem.evolutionCycles += 1;

    if (action === 'approved' && node.analysis) {
      if (node.analysis.architecturalStyle && !mem.preferredStyles.includes(node.analysis.architecturalStyle)) {
        mem.preferredStyles.push(node.analysis.architecturalStyle);
      }
      for (const mat of node.analysis.materials || []) {
        if (mat.name && !mem.preferredMaterials.includes(mat.name)) {
          mem.preferredMaterials.push(mat.name);
        }
      }
    }

    if (userNotes) {
      mem.sessionNotes.push(`[${new Date().toISOString()}] ${userNotes}`);
      if (mem.sessionNotes.length > 20) mem.sessionNotes.shift();
    }

    this.saveArchitecturalMemory(mem);
  }

  /**
   * Seamlessly augments a prompt with the user's evolved preferences.
   */
  public tailorPromptWithMemory(basePrompt: string): string {
    const mem = this.getArchitecturalMemory();
    const styleCue = mem.preferredStyles[0] || 'Contemporary Minimalist';
    const materialCue = mem.preferredMaterials.slice(0, 2).join(', ');
    const lightCue = mem.preferredLighting[0] || 'Warm golden-hour ambient illumination';

    if (basePrompt.toLowerCase().includes('style') || basePrompt.length > 180) {
      return basePrompt;
    }

    return `${basePrompt}, ${styleCue} aesthetic, refined ${materialCue}, ${lightCue}, sharp architectural focus`;
  }
}

export const canvasContextEngine = new CanvasContextEngine();
