/**
 * Project Service
 * Manages saved .ana projects — list, open, delete, metadata
 */

import { invoke } from '@tauri-apps/api/core';
import type { WorkflowFile } from '../workflow/WorkflowFileService';
import { logger } from '../../utils/logger';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ProjectMeta {
  filePath: string;
  name: string;
  status: 'active' | 'draft' | 'completed';
  sourceCount: number;
  outputCount: number;
  refCount: number;
  totalNodes: number;
  updatedAt: number;
  createdAt: number;
  thumbnailUrl?: string;
  promptSnippet?: string;
  modelTag?: string;
  hasImage: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

let cachedProjectsDir: string | null = null;

async function getProjectsDir(): Promise<string> {
  if (cachedProjectsDir) return cachedProjectsDir;
  const appData: string = await invoke('get_app_data_dir');
  const dir = `${appData}\\projects`;
  await invoke('ensure_dir', { path: dir });
  cachedProjectsDir = dir;
  return dir;
}

function extractFilename(path: string): string {
  const parts = path.replaceAll('\\', '/').split('/');
  const file = parts.at(-1) || 'untitled';
  return file.replace(/\.ana$/i, '');
}

export function timeAgo(ts: number): string {
  if (!ts) return 'just now';
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function extractFirstNodeImage(n: any): string | undefined {
  if (!n || !n.data) return undefined;
  const d = n.data;
  const candidates = [
    d.image,
    d.originalImage,
    d.outputData?.image,
    d.inputData?.image,
    d.compositeImage,
    d.maskImage,
    Array.isArray(d.images) ? d.images[0] : undefined,
    Array.isArray(d.refImages) ? d.refImages[0] : undefined,
    Array.isArray(d.referenceImages) ? d.referenceImages[0] : undefined,
  ];

  for (const img of candidates) {
    if (typeof img === 'string' && img.trim().length > 10) {
      return img.trim();
    }
  }
  return undefined;
}

function extractPrompt(n: any): string | undefined {
  if (!n || !n.data) return undefined;
  const d = n.data;
  const p = d.prompt || d.config?.prompt || d.inputData?.prompt || d.outputData?.prompt;
  if (typeof p === 'string' && p.trim().length > 0) {
    return p.trim();
  }
  return undefined;
}

function extractModelTag(n: any): string | undefined {
  if (!n || !n.data) return undefined;
  const d = n.data;
  const m = d.model || d.config?.model || d.params?.model || d.inputData?.metadata?.model;
  if (typeof m === 'string' && m.trim().length > 0) {
    const raw = m.trim().toLowerCase();
    if (raw.includes('flux')) return 'FLUX.1 Pro';
    if (raw.includes('sdxl') || raw.includes('stable-diffusion')) return 'SDXL';
    if (raw.includes('topaz')) return 'Topaz 4x';
    if (raw.includes('clarity')) return 'Clarity Upscale';
    if (raw.includes('midjourney')) return 'Midjourney';
    return m.split('/').pop() || m;
  }
  return undefined;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * List all saved projects from the projects directory
 */
export async function listProjects(): Promise<ProjectMeta[]> {
  const dir = await getProjectsDir();
  let filePaths: string[];
  try {
    filePaths = await invoke('list_dir', { path: dir, extension: 'ana' });
  } catch {
    return [];
  }

  const projects: ProjectMeta[] = [];

  for (const fp of filePaths) {
    try {
      const contents: string = await invoke('load_file', { path: fp });
      const wf: WorkflowFile = JSON.parse(contents);
      
      const nodes = Array.isArray(wf.nodes) ? wf.nodes : [];
      const edges = Array.isArray(wf.edges) ? wf.edges : [];

      const sourceNodes = nodes.filter(n => n.type === 'source' || n.data?.type === 'source');
      const outputNodes = nodes.filter(n => n.type === 'result' || n.data?.type === 'result' || (n.data?.type !== 'source' && (n.data?.image || n.data?.outputData?.image)));

      let thumbnailUrl: string | undefined = undefined;
      let promptSnippet: string | undefined = undefined;
      let modelTag: string | undefined = undefined;

      // Scan nodes for image, prompt, and model
      for (const n of nodes) {
        if (!thumbnailUrl) {
          thumbnailUrl = extractFirstNodeImage(n);
        }
        if (!promptSnippet) {
          promptSnippet = extractPrompt(n);
        }
        if (!modelTag) {
          modelTag = extractModelTag(n);
        }
      }

      // Check saved viewport thumbnail screenshot if no node image was found
      if (!thumbnailUrl && wf.thumbnail && typeof wf.thumbnail === 'string' && wf.thumbnail.length > 100) {
        thumbnailUrl = wf.thumbnail;
      }

      const hasImage = !!thumbnailUrl;
      const status: 'active' | 'draft' | 'completed' = outputNodes.length > 0 ? 'completed' : hasImage ? 'active' : 'draft';

      projects.push({
        filePath: fp,
        name: wf.name || extractFilename(fp),
        status,
        sourceCount: sourceNodes.length,
        outputCount: outputNodes.length,
        refCount: edges.length,
        totalNodes: nodes.length,
        updatedAt: wf.updatedAt || wf.createdAt || Date.now(),
        createdAt: wf.createdAt || Date.now(),
        thumbnailUrl,
        promptSnippet,
        modelTag,
        hasImage,
      });
    } catch (err) {
      logger.warn('[ProjectService] Skipping corrupt file:', fp, err);
    }
  }

  // Sort by most recently updated
  projects.sort((a, b) => b.updatedAt - a.updatedAt);
  return projects;
}

/**
 * Delete a project file
 */
export async function deleteProject(filePath: string): Promise<void> {
  await invoke('delete_file', { path: filePath });
}

/**
 * Save workflow into the projects directory (quick save)
 */
export async function saveProjectToDir(
  name: string,
  workflow: WorkflowFile
): Promise<string> {
  const dir = await getProjectsDir();
  const safeName = name.replaceAll(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'untitled';
  const filePath = `${dir}\\${safeName}.ana`;
  const json = JSON.stringify(workflow, null, 2);
  await invoke('save_file', { path: filePath, contents: json });
  return filePath;
}

/**
 * Rename a project — updates the .name field inside the file and renames it
 */
export async function renameProject(filePath: string, newName: string): Promise<string> {
  const contents: string = await invoke('load_file', { path: filePath });
  const wf = JSON.parse(contents);
  wf.name = newName;
  const dir = await getProjectsDir();
  const safeName = newName.replaceAll(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'untitled';
  const newPath = `${dir}\\${safeName}.ana`;
  await invoke('save_file', { path: newPath, contents: JSON.stringify(wf, null, 2) });
  if (newPath !== filePath) {
    try { await invoke('delete_file', { path: filePath }); } catch { /* ignore */ }
  }
  return newPath;
}

/**
 * Duplicate a project with a " (Copy)" suffix
 */
export async function duplicateProject(filePath: string): Promise<string> {
  const contents: string = await invoke('load_file', { path: filePath });
  const wf = JSON.parse(contents);
  const baseName = (wf.name || extractFilename(filePath)) + ' (Copy)';
  wf.name = baseName;
  wf.createdAt = Date.now();
  wf.updatedAt = Date.now();
  return saveProjectToDir(baseName, wf);
}

/**
 * Get projects directory path
 */
export { getProjectsDir };
