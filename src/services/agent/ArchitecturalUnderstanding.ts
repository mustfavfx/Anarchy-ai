/**
 * Architectural Understanding Schema
 * 
 * Inspired by:
 * - pzsacc/Morpheus: Multi-dimensional visual decomposition (Style, Composition, Lighting, Materials)
 * - AECFoundry/AECV-Bench: Rigorous AEC spatial literacy, door/window counting, realism & fidelity metrics
 * - jianzhou0420/AgentCanvas: Typed node-and-wire live graph awareness
 */

import type { SemanticCategory } from '../../features/builder/types';

export interface ArchitecturalComposition {
  framing: string;            // e.g. "Eye-level 2-point perspective", "Axonometric overview", "Interior worm's eye"
  massing: string;            // e.g. "Horizontal rectilinear cantilevers over recessed glazed podium"
  focalPoint: string;         // e.g. "Central atrium staircase", "Double-height curtain wall"
  symmetry: 'axial' | 'asymmetric-balanced' | 'radial' | 'irregular' | 'unverified';
  spatialDepth: 'deep' | 'shallow' | 'compressed' | 'unverified';
}

export interface TectonicMaterial {
  name: string;               // e.g. "Board-formed architectural concrete", "Natural travertine", "Charred cedar shou-sugi-ban"
  finish: string;             // e.g. "Matte textured with tie-rod indentations", "Polished vein-cut", "Brushed anodized"
  location: string;           // e.g. "Upper facade cantilever", "Interior flooring", "Feature wall"
  reflectivity: 'matte' | 'semi-gloss' | 'specular' | 'rough' | 'unverified';
}

export interface EnvironmentalLighting {
  timeOfDay: 'dawn' | 'morning' | 'midday' | 'golden-hour' | 'twilight' | 'night' | 'unverified';
  source: 'natural-direct' | 'overcast-diffused' | 'artificial-warm' | 'ambient' | 'mixed' | 'unverified';
  colorTempK: number;         // e.g. 2700, 3200, 5600, 6500
  shadowQuality: 'sharp-crisp' | 'soft-ambient' | 'dramatic-chiaroscuro' | 'unverified';
  sunAzimuth?: string;        // e.g. "Low angle side lighting from West"
}

export interface AECElementsInventory {
  doorsCount?: number;
  windowsCount?: number;
  floorsEstimated?: number;
  curtainWallsPresent: boolean;
  cantileversPresent: boolean;
  vegetationContext: string;  // e.g. "Dense temperate woodland", "Arid desert xeriscape", "Urban streetscape"
  scaleIndicator: 'human-present' | 'furniture-scaled' | 'structural-scaled' | 'ambiguous';
}

export interface AECCritiqueScore {
  architecturalRealismScore: number;   // 0 - 100
  materialFidelityScore: number;       // 0 - 100
  lightingConsistencyScore: number;    // 0 - 100
  overallScore: number;                // 0 - 100
  strengths: string[];
  weaknesses: string[];
  suggestedPromptRefinements: string[];
}

export interface StructuredArchitecturalAnalysis {
  category: SemanticCategory;
  subTypology: string;                 // e.g. "Two-Story Residential Villa", "Open-Plan Living & Dining"
  architecturalStyle: string;          // e.g. "Contemporary Minimalist", "Brutalist", "Deconstructivist", "Japandi"
  description: string;                 // Concise architectural summary
  composition: ArchitecturalComposition;
  materials: TectonicMaterial[];
  lighting: EnvironmentalLighting;
  aecElements: AECElementsInventory;
  critique: AECCritiqueScore;
  tags: string[];
  analyzedAt: number;
}

export interface NodeContext {
  id: string;
  label?: string;
  type: 'source' | 'ghost' | 'result' | 'dummy' | 'group';
  image?: string;
  originalImage?: string;
  prompt?: string;
  model?: string;
  parameters?: Record<string, any>;
  parentNodes: string[];               // Node IDs providing input to this node
  childNodes: string[];                // Node IDs receiving output from this node
  generatedFrom?: string;              // Ancestral root node ID in sequential branching
  analysis?: StructuredArchitecturalAnalysis;
}

export interface NodeComparisonReport {
  nodeA: { id: string; label?: string; prompt?: string; image?: string; score?: number };
  nodeB: { id: string; label?: string; prompt?: string; image?: string; score?: number };
  promptDiff: {
    addedKeywords: string[];
    removedKeywords: string[];
    styleShift?: string;
  };
  parameterDiff: {
    modelDiff?: { a?: string; b?: string };
    stepsDiff?: { a?: number; b?: number };
    cfgDiff?: { a?: number; b?: number };
    changedParams: string[];
  };
  visualDiff: {
    compositionChange: string;
    materialChange: string;
    lightingChange: string;
    realismScoreDelta: number; // Positive means B is better, negative means B is worse
  };
  diagnosisVerdict: 'improved' | 'regressed' | 'stylistic-variation' | 'inconclusive';
  expertExplanation: string;
  actionableRecommendations: string[];
}

export interface CanvasGraphSnapshot {
  nodesCount: number;
  imageNodesCount: number;
  nodes: NodeContext[];
  edges: Array<{ id: string; source: string; target: string; sourceHandle?: string; targetHandle?: string }>;
  lineages: Record<string, string[]>; // Map of leafNodeId -> ancestorNodeIds[]
}

// ── OpenViking Hierarchical VFS & Layered Context Types ──────────────────────

/**
 * L0: Abstract context summary (Ultra-token-efficient: ~15 tokens per node).
 */
export interface NodeContextL0 {
  id: string;
  label?: string;
  category: SemanticCategory;
  type: string;
  hasImage: boolean;
  parentCount: number;
  childCount: number;
  uri: string; // "canvas://nodes/{id}/L0"
}

/**
 * L1: Overview context including prompts, engines, parameters, and lineage (~70 tokens).
 */
export interface NodeContextL1 extends NodeContextL0 {
  prompt?: string;
  model?: string;
  dimensions?: { width: number; height: number };
  parameters?: Record<string, unknown>;
  parentNodes: string[];
  childNodes: string[];
  generatedFrom?: string;
}

/**
 * L2: Deep multimodal context with full AEC visual breakdown, critique, and materials (~400 tokens).
 */
export interface NodeContextL2 extends NodeContextL1 {
  analysis?: StructuredArchitecturalAnalysis;
  rawImageKey?: string;
}

/**
 * OpenViking Self-Evolving Architectural Memory.
 * Automatically tracks and persists user design preferences across generations.
 */
export interface AgentArchitecturalMemory {
  preferredStyles: string[];
  preferredMaterials: string[];
  preferredLighting: string[];
  dislikedElements: string[];
  typicalAspectRatio?: string;
  preferredEngine?: string;
  projectMission?: string;
  sessionNotes: string[];
  updatedAt: number;
  evolutionCycles: number;
}

// ── Autonomous Canvas Action Dispatches ───────────────────────────────────────

export type CanvasActionType =
  | 'fork_node'
  | 'focus_node'
  | 'select_node'
  | 'update_prompt'
  | 'compare_nodes'
  | 'critique_node'
  | 'rearrange_canvas';

export interface CanvasAction {
  type: CanvasActionType;
  nodeId?: string;
  parentId?: string;
  nodeIdA?: string;
  nodeIdB?: string;
  prompt?: string;
  label?: string;
  parameters?: Record<string, any>;
}

