import { describe, it, expect, beforeEach } from 'vitest';
import { canvasContextEngine } from './CanvasContextEngine';
import { useAIConfigStore } from '../../stores/aiConfigStore';

describe('CanvasContextEngine', () => {
  beforeEach(() => {
    // Setup mock canvas graph
    useAIConfigStore.setState({
      workflowSnapshot: {
        nodes: [
          {
            id: 'node-1',
            type: 'source',
            position: { x: 0, y: 0 },
            data: {
              label: 'Initial Sketch',
              image: 'data:image/png;base64,mock1',
              prompt: 'modern minimalist villa facade with concrete',
              type: 'source',
              processingType: 'source',
              state: 'ready',
              createdAt: Date.now(),
              lineage: { generation: 0, branchIndex: 0, processingType: 'source', ancestry: [] },
            },
          },
          {
            id: 'node-2',
            type: 'result',
            position: { x: 300, y: 0 },
            data: {
              label: 'Refined Result',
              image: 'data:image/png;base64,mock2',
              prompt: 'modern villa night scene warm interior lights',
              type: 'result',
              processingType: 'render',
              state: 'ready',
              createdAt: Date.now(),
              lineage: { generation: 1, branchIndex: 0, processingType: 'render', ancestry: ['node-1'] },
            },
          },
        ] as any,
        edges: [
          { id: 'e1-2', source: 'node-1', target: 'node-2' },
        ] as any,
      },
      selectedNode: {
        id: 'node-2',
        type: 'result',
        image: 'data:image/png;base64,mock2',
        prompt: 'modern villa night scene warm interior lights',
        state: 'ready',
      },
      canvasImages: [
        { id: 'node-1', label: 'Initial Sketch', image: 'data:image/png;base64,mock1', prompt: 'modern minimalist villa facade with concrete' },
        { id: 'node-2', label: 'Refined Result', image: 'data:image/png;base64,mock2', prompt: 'modern villa night scene warm interior lights' },
      ],
    });
  });

  it('retrieves the selected node and parses parent lineage correctly', () => {
    const selected = canvasContextEngine.getSelectedNode();
    expect(selected).not.toBeNull();
    expect(selected?.id).toBe('node-2');
    expect(selected?.parentNodes).toContain('node-1');
  });

  it('traverses parent and child nodes correctly', () => {
    const parents = canvasContextEngine.getParentNodes('node-2');
    expect(parents.length).toBe(1);
    expect(parents[0].id).toBe('node-1');

    const children = canvasContextEngine.getChildNodes('node-1');
    expect(children.length).toBe(1);
    expect(children[0].id).toBe('node-2');
  });

  it('produces an accurate topological snapshot of the canvas graph', () => {
    const graph = canvasContextEngine.getCanvasGraph();
    expect(graph.nodesCount).toBe(2);
    expect(graph.edges.length).toBe(1);
    expect(graph.lineages['node-2']).toContain('node-1');
  });

  it('generates a formatted canvas summary for the AI Agent', () => {
    const summary = canvasContextEngine.getCanvasSummaryForAgent();
    expect(summary).toContain('Active Canvas Graph contains 2 nodes');
    expect(summary).toContain('node-1');
    expect(summary).toContain('node-2');
  });

  it('performs comparative diagnosis between two nodes', async () => {
    const report = await canvasContextEngine.compareNodes('node-1', 'node-2');
    expect(report.nodeA.id).toBe('node-1');
    expect(report.nodeB.id).toBe('node-2');
    expect(report.promptDiff.addedKeywords).toContain('night');
    expect(report.promptDiff.removedKeywords).toContain('concrete');
    expect(report.expertExplanation).toBeDefined();
    expect(report.actionableRecommendations.length).toBeGreaterThan(0);
  });

  describe('OpenViking Layered Context & VFS Protocol', () => {
    it('generates ultra-compact L0 summaries for all nodes', () => {
      const allL0 = canvasContextEngine.getAllNodesL0();
      expect(allL0.length).toBe(2);
      expect(allL0[0].id).toBe('node-1');
      expect(allL0[0].uri).toBe('canvas://nodes/node-1/L0');
      expect(allL0[1].id).toBe('node-2');
      expect(allL0[1].parentCount).toBe(1);
    });

    it('resolves L1 overview context with prompts and parameters', () => {
      const l1 = canvasContextEngine.getNodeL1('node-2');
      expect(l1).not.toBeNull();
      expect(l1?.prompt).toContain('modern villa night scene');
      expect(l1?.parentNodes).toContain('node-1');
      expect(l1?.uri).toBe('canvas://nodes/node-2/L1');
    });

    it('navigates the canvas filesystem with ls()', async () => {
      const rootEntries = await canvasContextEngine.ls('canvas://');
      expect(rootEntries).toContain('nodes');
      expect(rootEntries).toContain('memory');

      const nodeEntries = await canvasContextEngine.ls('canvas://nodes');
      expect(nodeEntries).toContain('node-1');
      expect(nodeEntries).toContain('node-2');

      const subEntries = await canvasContextEngine.ls('canvas://nodes/node-1');
      expect(subEntries).toContain('L0');
      expect(subEntries).toContain('L1');
      expect(subEntries).toContain('L2');
    });

    it('reads node resources via cat()', async () => {
      const l0 = await canvasContextEngine.cat('canvas://nodes/node-1/L0');
      expect(l0?.id).toBe('node-1');

      const l1 = await canvasContextEngine.cat('canvas://nodes/node-2/L1');
      expect(l1?.prompt).toContain('night scene');

      const mem = await canvasContextEngine.cat('canvas://memory/preferences');
      expect(mem.preferredStyles).toBeDefined();
    });

    it('finds nodes by text query', () => {
      const found = canvasContextEngine.find({ query: 'night' });
      expect(found.length).toBe(1);
      expect(found[0].id).toBe('node-2');
    });

    it('augments prompts with self-evolving memory preferences', () => {
      const augmented = canvasContextEngine.tailorPromptWithMemory('Luxury modern villa');
      expect(augmented).toContain('Luxury modern villa');
      expect(augmented).toContain('Contemporary Minimalist');
    });
  });
});

