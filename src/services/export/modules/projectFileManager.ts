import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import type { Node, Edge } from '@xyflow/react';
import {
  sanitize,
  PROGRAM_IDENTITY
} from './exportTypes';
import { stripCallbacks } from './imageExportUtils';

/**
 * Export project with enhanced program identity (.ana)
 * Returns the saved file path or null if cancelled
 */
export async function exportProjectWithIdentity(
  nodes: Node[],
  edges: Edge[],
  name: string,
  thumbnail?: string
): Promise<string | null> {
  const projectData = {
    signature: PROGRAM_IDENTITY.signature,
    version: PROGRAM_IDENTITY.version,
    fileVersion: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    program: PROGRAM_IDENTITY.name,
    programVersion: PROGRAM_IDENTITY.version,
    website: PROGRAM_IDENTITY.website,
    name,
    nodes: nodes.map(n => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: stripCallbacks(n.data as Record<string, any>),
    })),
    edges: edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      type: e.type,
      animated: e.animated,
      style: e.style,
      data: e.data,
    })),
    thumbnail,
    metadata: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      exportedAt: new Date().toISOString(),
    }
  };
  
  const json = JSON.stringify(projectData, null, 2);
  
  // Show save dialog
  const safeName = sanitize(name) || 'untitled';
  const filePath = await save({
    defaultPath: `${safeName}.${PROGRAM_IDENTITY.fileExtension}`,
    filters: [
      { name: PROGRAM_IDENTITY.fileDescription, extensions: [PROGRAM_IDENTITY.fileExtension] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  
  if (!filePath) return null;
  
  // Save via Tauri
  await invoke('save_file', { path: filePath, contents: json });
  
  return filePath;
}

/**
 * Load project with identity verification
 */
export async function loadProjectWithIdentity(filePath: string): Promise<{
  nodes: Node[];
  edges: Edge[];
  name: string;
  valid: boolean;
  signature?: string;
}> {
  const contents: string = await invoke('load_file', { path: filePath });
  const project = JSON.parse(contents);
  
  // Check signature if present (for backwards compatibility)
  const hasValidSignature = !project.signature || project.signature === PROGRAM_IDENTITY.signature;
  
  return {
    nodes: project.nodes?.map((n: any) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: n.data,
    })) || [],
    edges: project.edges?.map((e: any) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      type: e.type,
      animated: e.animated,
      style: e.style,
      data: e.data,
    })) || [],
    name: project.name || filePath.split(/[\\/]/).pop()?.replace(/\.ana$/i, '') || 'Untitled',
    valid: hasValidSignature,
    signature: project.signature,
  };
}
