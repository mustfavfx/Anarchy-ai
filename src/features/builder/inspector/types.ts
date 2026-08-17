/**
 * types.ts
 * Shared types for the Enhance Region (selective upscale) and Smart Mask (inpaint) tools.
 * Integration point: these should live alongside your existing BuilderPage.tsx domain types.
 */

// ---------- Geometry / coordinate space ----------

export interface CanvasTransform {
  panX: number;
  panY: number;
  zoom: number;
}

export interface ImageSpaceRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NaturalDimensions {
  naturalWidth: number;
  naturalHeight: number;
  displayWidth: number;
  displayHeight: number;
  canvasX: number; // node position in canvas space
  canvasY: number;
}

// ---------- Semantic classification ----------

export type SurfaceCategory =
  | 'glass_facade'
  | 'landscape'
  | 'structural'
  | 'interior_detail'
  | 'material'
  | 'unknown';

export interface SurfaceFeatures {
  edgeOrthogonality: number;
  colorVariance: number;
  specularHighlights: number;
  greenDominance: number;
  edgeDensity: number;
}

export interface ClassificationResult {
  category: SurfaceCategory;
  confidence: number;
  source: 'heuristic' | 'vision_model';
}

// ---------- Structural geometry lock ----------

export interface StructuralLine {
  points: [number, number][];
  confidence: number;
}

// ---------- Detected elements (snap-to-element) ----------

export interface DetectedElement {
  id: string;
  contour: { x: number; y: number }[];
  simplifiedContour: { x: number; y: number }[];
  boundingBox: { x: number; y: number; w: number; h: number };
  area: number;
  depth: number;
  label?: string; // 'window' | 'column' | 'panel' — from classifier, optional
}

// ---------- Mask sources (brush vs snap-to-element) ----------

export interface BrushStroke {
  points: { x: number; y: number }[];
  brushSize: number;
}

export type MaskSource =
  | { kind: 'brush'; strokes: BrushStroke[] }
  | { kind: 'element'; element: DetectedElement };

// ---------- AI engines ----------

export type EngineRole = 'upscale' | 'inpaint' | 'render';
export type MaskCapability = 'binary_mask' | 'semantic_text' | 'hybrid';

export interface AIModelEngine {
  id: string;
  name: string;
  role: EngineRole;
  creditCost: number;
  maskCapability?: MaskCapability; // required when role === 'inpaint'
}

// ---------- Ghost set generation ----------

export interface GhostResult {
  engineId: string;
  holdId: string;
  status: 'success' | 'failed';
  imageUrl?: string;
  error?: string;
}

export interface HistoryNodeRecord {
  id: string;
  rootId: string;
  parentId: string;
  outputImageUrl: string;
  maskImageUrl?: string;
  prompt?: string;
  model: string;
  timestamp: number;
}

// ---------- Credit ledger ----------

export type CreditEntryStatus = 'held' | 'committed' | 'released';

export interface CreditLedgerEntry {
  id: string;
  holdId: string;
  engineId: string;
  amount: number;
  status: CreditEntryStatus;
  ghostSetId: string;
  timestamp: number;
}

// ---------- Presets ----------

export interface PresetPrompt {
  id: string;
  text: string;
  category: string;
  compatibleTools: ('enhance' | 'mask')[];
  tags: string[];
  usageCount?: number;
}

// ---------- Project memory ----------

export interface ProjectMemoryEntry {
  category: string;
  toolType: 'enhance' | 'mask';
  preferredEngineId: string;
  preferredParams: Record<string, number | string>;
  successCount: number;
  lastUsedAt: number;
}

export type ProjectMemoryStore = Record<string, ProjectMemoryEntry>;
