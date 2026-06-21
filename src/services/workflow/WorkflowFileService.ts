/**
 * Workflow File Service
 * Save/Load .ana workflow files using Tauri native dialogs + file I/O
 */

import { invoke } from '@tauri-apps/api/core';
import { save, open } from '@tauri-apps/plugin-dialog';
import type { Node, Edge } from '@xyflow/react';
import { getLocalImage, cacheLocalImage } from '../history/HistoryService';
import { SettingsService } from '../settings';

// ── File format ──────────────────────────────────────────────────────────────

const FILE_EXTENSION = 'ana';
const FILE_DESCRIPTION = 'Anarchy AI Project';
const FILE_VERSION = 1;
const PROGRAM_SIGNATURE = 'ANARCHY_AI_PROJECT_FILE';
const PROGRAM_NAME = 'Anarchy AI';
const PROGRAM_VERSION = '0.0.8';

export interface WorkflowFile {
  signature: string; // Program identity signature
  version: number;
  fileVersion: number; // File format version
  appVersion: string;
  program: string; // Program name
  programVersion: string; // Program version
  website: string; // Program website
  createdAt: number;
  updatedAt: number;
  name: string;
  nodes: SerializedNode[];
  edges: SerializedEdge[];
  thumbnail?: string; // Base64 encoded image preview
  metadata?: {
    nodeCount: number;
    edgeCount: number;
    exportedAt: string;
  };
}

interface SerializedNode {
  id: string;
  type: string | undefined;
  position: { x: number; y: number };
  data: Record<string, any>;
}

interface SerializedEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  type?: string;
  animated?: boolean;
  style?: Record<string, any>;
  data?: Record<string, any>;
  markerEnd?: any;
}

// ── Serialization helpers ────────────────────────────────────────────────────

/** Strip runtime callbacks from node data before saving */
function stripCallbacks(data: Record<string, unknown>): Record<string, unknown> {
  const CALLBACK_KEYS = new Set(['onAddChild', 'onImageUpload', 'onDelete', 'onExecute', 'onRetry']);
  return Object.fromEntries(Object.entries(data).filter(([k]) => !CALLBACK_KEYS.has(k)));
}

async function serializeNodes(nodes: Node[]): Promise<SerializedNode[]> {
  const serializedList: SerializedNode[] = [];
  for (const node of nodes) {
    const dataCopy = JSON.parse(JSON.stringify(stripCallbacks(node.data as Record<string, any>)));
    
    // Resolve main image from IDB to Base64
    if (dataCopy.image && dataCopy.image.startsWith('idb://')) {
      const base64 = await getLocalImage(dataCopy.image);
      if (base64) {
        dataCopy.image = base64;
      }
    }
    
    // Resolve original image from IDB to Base64
    if (dataCopy.originalImage && dataCopy.originalImage.startsWith('idb://')) {
      const base64 = await getLocalImage(dataCopy.originalImage);
      if (base64) {
        dataCopy.originalImage = base64;
      }
    }
    
    // Resolve output data image from IDB to Base64
    if (dataCopy.outputData?.image && dataCopy.outputData.image.startsWith('idb://')) {
      const base64 = await getLocalImage(dataCopy.outputData.image);
      if (base64) {
        dataCopy.outputData.image = base64;
      }
    }
    
    serializedList.push({
      id: node.id,
      type: node.type,
      position: { x: node.position.x, y: node.position.y },
      data: dataCopy,
    });
  }
  return serializedList;
}

function serializeEdges(edges: Edge[]): SerializedEdge[] {
  return edges.map(edge => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    type: edge.type,
    animated: edge.animated,
    style: edge.style as Record<string, any>,
    data: edge.data as Record<string, any>,
    markerEnd: edge.markerEnd,
  }));
}

async function deserializeNodes(serialized: SerializedNode[]): Promise<Node[]> {
  const deserializedList: Node[] = [];
  for (const s of serialized) {
    const dataCopy = JSON.parse(JSON.stringify(s.data));
    let mainImageKey: string | undefined = undefined;
    
    // Cache main image from Base64 back to IDB
    if (dataCopy.image && dataCopy.image.startsWith('data:')) {
      const uuid = crypto.randomUUID();
      mainImageKey = `idb://${uuid}`;
      await cacheLocalImage(mainImageKey, dataCopy.image);
      dataCopy.image = mainImageKey;
    }
    
    // Cache original image from Base64 back to IDB
    if (dataCopy.originalImage && dataCopy.originalImage.startsWith('data:')) {
      if (dataCopy.originalImage === s.data.image && mainImageKey) {
        dataCopy.originalImage = mainImageKey;
      } else {
        const uuid = crypto.randomUUID();
        const imageKey = `idb://${uuid}`;
        await cacheLocalImage(imageKey, dataCopy.originalImage);
        dataCopy.originalImage = imageKey;
      }
    }
    
    // Cache output data image from Base64 back to IDB
    if (dataCopy.outputData?.image && dataCopy.outputData.image.startsWith('data:')) {
      if (dataCopy.outputData.image === s.data.image && mainImageKey) {
        dataCopy.outputData.image = mainImageKey;
      } else {
        const uuid = crypto.randomUUID();
        const imageKey = `idb://${uuid}`;
        await cacheLocalImage(imageKey, dataCopy.outputData.image);
        dataCopy.outputData.image = imageKey;
      }
    }
    
    deserializedList.push({
      id: s.id,
      type: s.type,
      position: s.position,
      data: dataCopy,
    });
  }
  return deserializedList;
}

function deserializeEdges(serialized: SerializedEdge[]): Edge[] {
  return serialized.map(s => ({
    id: s.id,
    source: s.source,
    target: s.target,
    sourceHandle: s.sourceHandle,
    targetHandle: s.targetHandle,
    type: s.type,
    animated: s.animated,
    style: s.style,
    data: s.data,
    markerEnd: s.markerEnd,
  }));
}

// ── Public API ───────────────────────────────────────────────────────────────

let lastSavePath: string | null = null;

/**
 * Save workflow to a file. Shows native "Save As" dialog if no path is known.
 * Returns the saved file path, or null if cancelled.
 */
export async function saveWorkflow(
  nodes: Node[],
  edges: Edge[],
  options?: { forceDialog?: boolean; name?: string; thumbnail?: string; filePath?: string | null }
): Promise<string | null> {
  const pathToCheck = options?.filePath !== undefined ? options.filePath : lastSavePath;
  const needsDialog = options?.forceDialog || !pathToCheck;

  let filePath = pathToCheck;

  if (needsDialog) {
    const saveLocation = SettingsService.get('saveLocation') || '';
    const baseName = (options?.name || 'untitled').replace(/\.ana$/i, '');
    const defaultPath = saveLocation
      ? `${saveLocation}\\${baseName}.ana`
      : `${baseName}.ana`;
    const selected = await save({
      defaultPath,
      filters: [{ name: FILE_DESCRIPTION, extensions: [FILE_EXTENSION] }],
    });
    if (!selected) return null; // User cancelled
    filePath = selected;
  }

  if (!filePath) return null;

  const workflow: WorkflowFile = {
    signature: PROGRAM_SIGNATURE,
    version: FILE_VERSION,
    fileVersion: FILE_VERSION,
    appVersion: PROGRAM_VERSION,
    program: PROGRAM_NAME,
    programVersion: PROGRAM_VERSION,
    website: 'https://anarchy-ai.com',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    name: options?.name || extractFilename(filePath),
    nodes: await serializeNodes(nodes),
    edges: serializeEdges(edges),
    thumbnail: options?.thumbnail,
    metadata: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      exportedAt: new Date().toISOString(),
    },
  };

  const json = JSON.stringify(workflow, null, 2);
  await invoke('save_file', { path: filePath, contents: json });

  // Also save a copy to the projects directory for the Projects page
  try {
    const appData: string = await invoke('get_app_data_dir');
    const projectsDir = `${appData}\\projects`;
    await invoke('ensure_dir', { path: projectsDir });
    const safeName = workflow.name.replaceAll(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'untitled';
    const projectCopy = `${projectsDir}\\${safeName}.ana`;
    await invoke('save_file', { path: projectCopy, contents: json });
  } catch { /* non-critical */ }

  lastSavePath = filePath;
  return filePath;
}

/**
 * "Save As" - always shows the dialog.
 */
export async function saveWorkflowAs(
  nodes: Node[],
  edges: Edge[],
  name?: string,
  thumbnail?: string,
  filePath?: string | null
): Promise<string | null> {
  return saveWorkflow(nodes, edges, { forceDialog: true, name, thumbnail, filePath });
}

/**
 * Load workflow from a file. Shows native "Open" dialog.
 * Returns { nodes, edges, name } or null if cancelled.
 */
export async function loadWorkflow(): Promise<{
  nodes: Node[];
  edges: Edge[];
  name: string;
  filePath: string;
} | null> {
  const selected = await open({
    multiple: false,
    filters: [{ name: FILE_DESCRIPTION, extensions: [FILE_EXTENSION] }],
  });

  if (!selected) return null; // User cancelled

  const filePath = selected;
  const contents: string = await invoke('load_file', { path: filePath });
  const workflow: WorkflowFile = JSON.parse(contents);

  // Version check
  if (!workflow.version || !workflow.nodes) {
    throw new Error('Invalid workflow file format');
  }

  // Validate program signature (if present - for backwards compatibility)
  if (workflow.signature && workflow.signature !== PROGRAM_SIGNATURE) {
    throw new Error('Invalid project file signature. This file may be corrupted or from a different program.');
  }

  lastSavePath = filePath;
  return {
    nodes: await deserializeNodes(workflow.nodes),
    edges: deserializeEdges(workflow.edges),
    name: workflow.name || extractFilename(filePath),
    filePath,
  };
}

/** Get the current save path (null if never saved) */
export function getCurrentFilePath(): string | null {
  return lastSavePath;
}

/** Set the active save path */
export function setCurrentFilePath(path: string | null): void {
  lastSavePath = path;
}

/** Reset save path (e.g. when creating a new project) */
export function resetFilePath(): void {
  lastSavePath = null;
}

// ── Utilities ────────────────────────────────────────────────────────────────

function extractFilename(path: string): string {
  const parts = path.replaceAll('\\', '/').split('/');
  const file = parts.at(-1) || 'untitled';
  return file.replace(/\.ana$/i, '');
}
