/**
 * ConnectedNodeInspectorPanel.tsx
 * 
 * Wired wrapper around NodeInspectorPanel that connects:
 * - useBuilderCredits (real credit balance)
 * - replicateService (real AI engine dispatch)
 * - useBuilderWorkflow addChildNode / spawnGhostNode (real history save)
 * - PRESET_PROMPTS (real 62-preset library)
 * - aiConfigStore (project memory via session storage)
 *
 * Used in EnlargedPreview.tsx — Enhance tab.
 */

import React, { useMemo, useCallback, useRef } from 'react';
import { useAIConfigStore } from '../../../stores/aiConfigStore';
import { replicateService } from '../../../services/replicate';
import { addHistoryEntry } from '../../../services/history/HistoryService';
import { PRESET_PROMPTS } from '../presetPrompts';
import { NodeInspectorPanel } from './NodeInspectorPanel';
import type { AIModelEngine, PresetPrompt, ProjectMemoryStore } from './types';

interface ConnectedNodeInspectorPanelProps {
  nodeId: string;
  sourceImageUrl: string;
  onImageCommitted?: (imageUrl: string) => void;
}

// Adapt PRESET_PROMPTS (PresetGroup[]) → PresetPrompt[] (inspector format)
function adaptPresets(groups: typeof PRESET_PROMPTS): PresetPrompt[] {
  return groups.flatMap((group) =>
    group.prompts.map((p, i) => ({
      id: group.category + '-' + i,
      text: p.text,
      category: group.category.toLowerCase().replace(/\s+/g, '_'),
      compatibleTools: ['enhance', 'mask'] as ('enhance' | 'mask')[],
      tags: p.bestFor ?? [],
      usageCount: 0,
    }))
  );
}

export const ConnectedNodeInspectorPanel: React.FC<ConnectedNodeInspectorPanelProps> = ({
  nodeId,
  sourceImageUrl,
  onImageCommitted,
}) => {
  const userCredits = useAIConfigStore((s) => s.userCredits);
  const selectedNode   = useAIConfigStore((s) => s.selectedNode);
  const nodeImageUpdateFn = useAIConfigStore((s) => s.nodeImageUpdateFn);

  // Project memory — persisted in sessionStorage per-tab
  const [projectMemory, setProjectMemory] = React.useState<ProjectMemoryStore>(() => {
    try {
      const raw = sessionStorage.getItem('anarchy:project-memory:' + nodeId);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const handleProjectMemoryChange = useCallback((next: ProjectMemoryStore) => {
    setProjectMemory(next);
    try {
      sessionStorage.setItem('anarchy:project-memory:' + nodeId, JSON.stringify(next));
    } catch {
      // sessionStorage full — ignore
    }
  }, [nodeId]);

  const allPresets = useMemo(() => adaptPresets(PRESET_PROMPTS), []);

  // callEngine: routes to replicateService.runPrediction
  const callEngine = useCallback(
    async (engine: AIModelEngine, payload: Record<string, unknown>): Promise<{ url: string }> => {
      const model = (payload.model as string) ?? engine.id;
      // Strip 'model' from input since runPrediction takes it separately
      const { model: _m, ...input } = payload;

      // Dispatch via replicateService.runPrediction(modelId, input)
      const result = await replicateService.runPrediction(model, input);

      if (!result?.output) throw new Error('Engine ' + engine.id + ' returned no output');
      const url = Array.isArray(result.output) ? result.output[0] : result.output as string;
      return { url };
    },
    []
  );

  // onCommitChildNode: saves image to history and updates node on canvas
  const onCommitChildNode = useCallback(
    (args: { imageUrl: string; engineId: string; prompt?: string; maskUrl?: string }) => {
      if (nodeImageUpdateFn && nodeId) {
        nodeImageUpdateFn(nodeId, args.imageUrl);
      }
      
      // Save to ANARCHY history
      addHistoryEntry({
        prompt: args.prompt ?? '',
        model: args.engineId as any,
        outputData: { image: args.imageUrl },
        processingType: args.maskUrl ? 'local' : 'upscale',
        parentId: nodeId,
        rootId: nodeId,
      }).catch(console.error);

      onImageCommitted?.(args.imageUrl);
    },
    [nodeId, nodeImageUpdateFn, onImageCommitted]
  );

  return (
    <NodeInspectorPanel
      nodeId={nodeId}
      sourceImageUrl={sourceImageUrl}
      allPresets={allPresets}
      detectedElements={[]}
      spatialGrid={{ query: () => [] } as any}
      totalBalance={userCredits}
      projectMemory={projectMemory}
      onProjectMemoryChange={handleProjectMemoryChange}
      callEngine={callEngine}
      onCommitChildNode={onCommitChildNode}
    />
  );
};

export default ConnectedNodeInspectorPanel;
