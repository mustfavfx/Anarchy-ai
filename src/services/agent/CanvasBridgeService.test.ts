import { describe, it, expect, beforeEach } from 'vitest';
import { canvasBridge } from './CanvasBridgeService';
import { canvasContextEngine } from './CanvasContextEngine';
import { parseCanvasActions } from './ArchitectAgentService';
import { useAIConfigStore } from '../../stores/aiConfigStore';

describe('Canvas Agent Interconnection & Actions', () => {
  beforeEach(() => {
    // Reset store state
    useAIConfigStore.setState({
      selectedNode: {
        id: 'node-101',
        type: 'result',
        image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        prompt: 'Modern architectural villa with concrete cantilever',
        state: 'ready',
      },
      workflowSnapshot: {
        nodes: [
          {
            id: 'node-101',
            type: 'baseNode',
            position: { x: 100, y: 100 },
            data: {
              prompt: 'Modern architectural villa with concrete cantilever',
              lineage: { parentId: undefined, generation: 0 },
              semantic: { category: 'building', label: 'Contemporary Villa' },
            },
          } as any,
          {
            id: 'node-102',
            type: 'baseNode',
            position: { x: 400, y: 100 },
            data: {
              prompt: 'Alternative night render with warm illumination',
              lineage: { parentId: 'node-101', generation: 1 },
              semantic: { category: 'building', label: 'Night Villa' },
            },
          } as any,
        ],
        edges: [
          { id: 'edge-1', source: 'node-101', target: 'node-102' } as any,
        ],
      },
    });
  });

  it('parses structured [CanvasAction: ...] commands correctly', () => {
    const rawAssistantText = 
      'Based on spatial analysis, I recommend branching this node:\n' +
      '[CanvasAction: {"type": "fork_node", "parentId": "node-101", "label": "Night Scene", "prompt": "Luxury night render with 3000K linear coves"}]\n' +
      '[CanvasAction: {"type": "focus_node", "nodeId": "node-102"}]';

    const actions = parseCanvasActions(rawAssistantText);
    expect(actions).toHaveLength(2);
    expect(actions[0].type).toBe('fork_node');
    expect(actions[0].parentId).toBe('node-101');
    expect(actions[0].label).toBe('Night Scene');
    expect(actions[1].type).toBe('focus_node');
    expect(actions[1].nodeId).toBe('node-102');
  });

  it('generates rich graph topology summary for the agent', () => {
    const summary = canvasContextEngine.getCanvasSummaryForAgent();
    expect(summary).toContain('Active Canvas Graph contains 2 nodes');
    expect(summary).toContain('★ [ACTIVE/SELECTED]');
    expect(summary).toContain('Branch v1 from #node-1');
  });

  it('executes focus_node action correctly', async () => {
    let focusedId: string | null = null;
    useAIConfigStore.getState().setFocusNodeFn((id) => {
      focusedId = id;
    });

    const result = await canvasBridge.executeCanvasAction({
      type: 'focus_node',
      nodeId: 'node-102',
    });

    expect(result.success).toBe(true);
    expect(focusedId).toBe('node-102');
  });

  it('executes update_prompt action correctly', async () => {
    let updatedPrompt: string | null = null;
    useAIConfigStore.getState().setNodePromptUpdateFn((nodeId, prompt) => {
      updatedPrompt = prompt;
    });

    const result = await canvasBridge.executeCanvasAction({
      type: 'update_prompt',
      nodeId: 'node-101',
      prompt: 'Refined prompt with 15mm negative shadow reveals',
    });

    expect(result.success).toBe(true);
    expect(updatedPrompt).toBe('Refined prompt with 15mm negative shadow reveals');
  });

  it('executes fork_node action through registered forkChildNode callback', async () => {
    let receivedParentId: string | null = null;
    let receivedLabel: string | null = null;

    useAIConfigStore.getState().setForkChildNodeFn((parentId, _image, label, _prompt) => {
      receivedParentId = parentId;
      receivedLabel = label || null;
      return 'new-child-103';
    });

    const result = await canvasBridge.executeCanvasAction({
      type: 'fork_node',
      parentId: 'node-101',
      label: 'Alternative Glazing Branch',
      prompt: 'Minimalist 20mm sightline glazing',
    });

    expect(result.success).toBe(true);
    expect(result.resultNodeId).toBe('new-child-103');
    expect(receivedParentId).toBe('node-101');
    expect(receivedLabel).toBe('Alternative Glazing Branch');
  });
});
