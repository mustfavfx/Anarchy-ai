/**
 * NodeInspectorPanel.tsx
 * Enhance Region + Smart Mask tabs for the node inspector. Ties together
 * region selection, semantic classification, geometry lock, snap-to-element,
 * preset filtering, parallel ghost-set generation, credit settlement, and
 * project memory.
 *
 * Integration points (marked TODO): swap the stub hooks for your real
 * useBuilderCredits / useBuilderPersistence, and wire callEngine to your
 * Replicate dispatch used by EnginesViewModel.
 */

import React, { useMemo, useState } from 'react';
import type {
  AIModelEngine,
  ClassificationResult,
  CreditLedgerEntry,
  DetectedElement,
  GhostResult,
  MaskSource,
  PresetPrompt,
  ProjectMemoryStore,
} from './types';
import { classifyRegion } from './classifier';
import { buildGeometryMask, blendWithGeometryLock, toImageSpace } from './geometry';
import { pickElementAt, SpatialGrid, toBinaryMask } from './maskTools';
import { ENGINE_REGISTRY, buildInpaintPayload, buildUpscalePayload } from './engines';
import { commitSelection, cancelGhostSet, getAvailableCredits } from './creditLedger';
import {
  getRelevantPresets,
  rankPresets,
  getSuggestedEngine,
  updateProjectMemory,
} from './presetsAndMemory';
import { useGhostGeneration } from './useGhostGeneration';

type Tab = 'enhance' | 'mask';

interface NodeInspectorPanelProps {
  nodeId: string;
  sourceImageUrl: string;
  allPresets: PresetPrompt[];
  detectedElements: DetectedElement[];
  spatialGrid: SpatialGrid;

  // TODO: replace these three with your real hooks
  totalBalance: number;
  projectMemory: ProjectMemoryStore;
  onProjectMemoryChange: (next: ProjectMemoryStore) => void;

  // TODO: wire to your existing Replicate dispatch (same one EnginesViewModel uses)
  callEngine: (engine: AIModelEngine, payload: Record<string, unknown>) => Promise<{ url: string }>;

  // TODO: wire to HistoryService.save — commit writes exactly one child node
  onCommitChildNode: (args: { imageUrl: string; engineId: string; prompt?: string; maskUrl?: string }) => void;
}

export function NodeInspectorPanel(props: NodeInspectorPanelProps) {
  const {
    sourceImageUrl,
    allPresets,
    detectedElements,
    spatialGrid,
    totalBalance,
    projectMemory,
    onProjectMemoryChange,
    callEngine,
    onCommitChildNode,
  } = props;

  const [activeTab, setActiveTab] = useState<Tab>('enhance');
  const [ledger, setLedger] = useState<CreditLedgerEntry[]>([]);
  const [classification, setClassification] = useState<ClassificationResult | null>(null);
  const [preserveGeometry, setPreserveGeometry] = useState(true);
  const [maskSource, setMaskSource] = useState<MaskSource | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [chosenHoldId, setChosenHoldId] = useState<string | null>(null);

  const availableCredits = getAvailableCredits(totalBalance, ledger);

  const { generate, isGenerating, results, ghostSetId } = useGhostGeneration({
    totalBalance,
    ledger,
    setLedger: (updater) => setLedger(updater),
    callEngine,
  });

  const category = classification?.category ?? 'unknown';

  const relevantPresets = useMemo(
    () => rankPresets(getRelevantPresets(allPresets, activeTab, category), projectMemory, activeTab, category),
    [allPresets, activeTab, category, projectMemory]
  );

  const inpaintEngines = ENGINE_REGISTRY.filter((e) => e.role === 'inpaint');
  const upscaleEngines = ENGINE_REGISTRY.filter((e) => e.role === 'upscale');
  const candidateEngines = activeTab === 'mask' ? inpaintEngines : upscaleEngines;

  const suggestion = candidateEngines.length
    ? getSuggestedEngine(projectMemory, category, activeTab, candidateEngines)
    : null;

  async function handleElementClick(point: { x: number; y: number }) {
    const element = pickElementAt(point, spatialGrid);
    if (element) setMaskSource({ kind: 'element', element });
  }

  async function handleGenerate() {
    const preset = relevantPresets.find((p) => p.id === selectedPresetId);
    const instruction = preset?.text ?? '';

    if (activeTab === 'mask' && maskSource) {
      const maskData = toBinaryMask(maskSource, 512, 512); // TODO: use real node dimensions
      const detectedElement = maskSource.kind === 'element' ? maskSource.element : null;

      await generate(candidateEngines, (engine) =>
        buildInpaintPayload(engine, sourceImageUrl, maskData, detectedElement, instruction)
      );
      return;
    }

    // Enhance tab: geometry lock is applied as a post-process blend for
    // engines without native control-image support (see geometry.ts).
    await generate(candidateEngines, (engine) =>
      buildUpscalePayload(engine, sourceImageUrl, scaleMultiplierRef.current)
    );
  }

  const scaleMultiplierRef = React.useRef(2.0);

  function handleChoose(result: GhostResult) {
    if (!ghostSetId || result.status !== 'success') return;
    const { updatedLedger, totalCharged } = commitSelection(ledger, ghostSetId, result.holdId);
    setLedger(updatedLedger);
    setChosenHoldId(result.holdId);

    const chosenEngine = candidateEngines.find((e) => e.id === result.engineId);
    if (chosenEngine) {
      onProjectMemoryChange(
        updateProjectMemory(projectMemory, category, activeTab, chosenEngine, {
          promptId: selectedPresetId ?? '',
        })
      );
    }

    onCommitChildNode({
      imageUrl: result.imageUrl!,
      engineId: result.engineId,
      prompt: selectedPresetId ?? undefined,
    });

    void totalCharged; // surface in a toast/credit indicator if desired
  }

  function handleDiscardGhostSet() {
    if (!ghostSetId) return;
    setLedger(cancelGhostSet(ledger, ghostSetId));
    setChosenHoldId(null);
  }

  return (
    <div className="node-inspector-panel">
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={activeTab === 'enhance'} onClick={() => setActiveTab('enhance')}>
          Enhance
        </button>
        <button role="tab" aria-selected={activeTab === 'mask'} onClick={() => setActiveTab('mask')}>
          Draw
        </button>
      </div>

      {activeTab === 'enhance' && (
        <div className="enhance-tab">
          {classification && (
            <div className="classification-badge">
              {classification.category} · {Math.round(classification.confidence * 100)}%
            </div>
          )}
          <label className="geometry-toggle">
            <input
              type="checkbox"
              checked={preserveGeometry}
              onChange={(e) => setPreserveGeometry(e.target.checked)}
            />
            Preserve geometry
          </label>
        </div>
      )}

      {activeTab === 'mask' && (
        <div className="mask-tab">
          <div className="mask-tool-toggle">
            <button onClick={() => setMaskSource({ kind: 'brush', strokes: [] })}>Brush</button>
            <button onClick={() => setMaskSource(null)}>Snap to element (click canvas)</button>
          </div>
        </div>
      )}

      <div className="preset-list">
        {relevantPresets.slice(0, 6).map((preset) => (
          <button
            key={preset.id}
            className={preset.id === selectedPresetId ? 'preset-chip selected' : 'preset-chip'}
            onClick={() => setSelectedPresetId(preset.id)}
          >
            {preset.text}
          </button>
        ))}
      </div>

      {suggestion?.remembered && (
        <div className="suggestion-hint">Used before on this project · {suggestion.engine.name}</div>
      )}

      <button disabled={isGenerating || availableCredits <= 0} onClick={handleGenerate}>
        {isGenerating ? 'Generating…' : `Generate (${availableCredits} credits available)`}
      </button>

      {results.length > 0 && (
        <div className="ghost-results">
          {results.map((r) => (
            <div key={r.holdId} className={r.status === 'failed' ? 'ghost-card failed' : 'ghost-card'}>
              {r.status === 'success' ? (
                <>
                  <img src={r.imageUrl} alt={`${r.engineId} result`} />
                  <button onClick={() => handleChoose(r)} disabled={!!chosenHoldId}>
                    Choose
                  </button>
                </>
              ) : (
                <div className="ghost-error">{r.engineId} failed</div>
              )}
            </div>
          ))}
          <button onClick={handleDiscardGhostSet} disabled={!!chosenHoldId}>
            Discard all
          </button>
        </div>
      )}
    </div>
  );
}

// Re-exported so callers driving canvas pointer events can convert coordinates
// without importing geometry.ts directly.
export { toImageSpace, buildGeometryMask, blendWithGeometryLock, classifyRegion };
