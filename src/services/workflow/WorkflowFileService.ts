/**
 * Workflow File Service
 * Save/Load .ana workflow files using Tauri native dialogs + file I/O
 */

import { invoke } from '@tauri-apps/api/core';
import { save, open } from '@tauri-apps/plugin-dialog';
import type { Node, Edge } from '@xyflow/react';

// ── File format ──────────────────────────────────────────────────────────────

const FILE_EXTENSION = 'ana';
const FILE_DESCRIPTION = 'Anarchy AI Project';
const FILE_VERSION = 1;

export interface WorkflowFile {
  version: number;
  appVersion: string;
  createdAt: number;
  updatedAt: number;
  name: string;
  nodes: SerializedNode[];
  edges: SerializedEdge[];
  thumbnail?: string; // Base64 encoded image preview
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
function stripCallbacks(data: Record<string, any>): Record<string, any> {
  const {
    onAddChild, onImageUpload, onDelete, onExecute, onRetry,
    ...rest
  } = data;
  return rest;
}

function serializeNodes(nodes: Node[]): SerializedNode[] {
  return nodes.map(node => ({
    id: node.id,
    type: node.type,
    position: { x: node.position.x, y: node.position.y },
    data: stripCallbacks(node.data as Record<string, any>),
  }));
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

function deserializeNodes(serialized: SerializedNode[]): Node[] {
  return serialized.map(s => ({
    id: s.id,
    type: s.type,
    position: s.position,
    data: s.data,
  }));
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
  options?: { forceDialog?: boolean; name?: string; thumbnail?: string }
): Promise<string | null> {
  const needsDialog = options?.forceDialog || !lastSavePath;

  let filePath = lastSavePath;

  if (needsDialog) {
    const selected = await save({
      defaultPath: options?.name || 'untitled.ana',
      filters: [{ name: FILE_DESCRIPTION, extensions: [FILE_EXTENSION] }],
    });
    if (!selected) return null; // User cancelled
    filePath = selected;
  }

  if (!filePath) return null;

  const workflow: WorkflowFile = {
    version: FILE_VERSION,
    appVersion: '0.07',
    createdAt: lastSavePath === filePath ? Date.now() : Date.now(),
    updatedAt: Date.now(),
    name: options?.name || extractFilename(filePath),
    nodes: serializeNodes(nodes),
    edges: serializeEdges(edges),
    thumbnail: options?.thumbnail,
  };

  const json = JSON.stringify(workflow, null, 2);
  await invoke('save_file', { path: filePath, contents: json });

  // Also save a copy to the projects directory for the Projects page
  try {
    const appData: string = await invoke('get_app_data_dir');
    const projectsDir = `${appData}\\projects`;
    await invoke('ensure_dir', { path: projectsDir });
    const projectCopy = `${projectsDir}\\${workflow.name.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'untitled'}.ana`;
    await invoke('save_file', { path: projectCopy, contents: json });
  } catch (e) {
    console.warn('[Workflow] Could not copy to projects dir:', e);
  }

  lastSavePath = filePath;
  console.log('[Workflow] Saved to:', filePath);
  return filePath;
}

/**
 * "Save As" - always shows the dialog.
 */
export async function saveWorkflowAs(
  nodes: Node[],
  edges: Edge[],
  name?: string,
  thumbnail?: string
): Promise<string | null> {
  return saveWorkflow(nodes, edges, { forceDialog: true, name, thumbnail });
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

  const filePath = selected as string;
  const contents: string = await invoke('load_file', { path: filePath });
  const workflow: WorkflowFile = JSON.parse(contents);

  // Version check
  if (!workflow.version || !workflow.nodes) {
    throw new Error('Invalid workflow file format');
  }

  lastSavePath = filePath;
  console.log('[Workflow] Loaded from:', filePath, '—', workflow.nodes.length, 'nodes,', workflow.edges.length, 'edges');

  return {
    nodes: deserializeNodes(workflow.nodes),
    edges: deserializeEdges(workflow.edges),
    name: workflow.name || extractFilename(filePath),
    filePath,
  };
}

/** Get the current save path (null if never saved) */
export function getCurrentFilePath(): string | null {
  return lastSavePath;
}

/** Reset save path (e.g. when creating a new project) */
export function resetFilePath(): void {
  lastSavePath = null;
}

// ── Utilities ────────────────────────────────────────────────────────────────

function extractFilename(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/');
  const file = parts[parts.length - 1] || 'untitled';
  return file.replace(/\.ana$/i, '');
}
