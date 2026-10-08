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

/**
 * Execute Tauri invoke with strict timeout protection to prevent hung IPC calls
 */
async function invokeWithTimeout<T>(cmd: string, args?: Record<string, any>, timeoutMs = 2500): Promise<T> {
  const call = args !== undefined ? invoke<T>(cmd, args) : invoke<T>(cmd);
  return Promise.race([
    call,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout executing Tauri command '${cmd}' after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

async function getProjectsDir(): Promise<string> {
  if (cachedProjectsDir) return cachedProjectsDir;
  try {
    const appData: string = await invokeWithTimeout<string>('get_app_data_dir', undefined, 2000);
    const dir = `${appData}\\projects`;
    await invokeWithTimeout('ensure_dir', { path: dir }, 2000).catch(() => {});
    cachedProjectsDir = dir;
    return dir;
  } catch (err) {
    logger.warn('[ProjectService] Failed to resolve projects directory:', err);
    throw err;
  }
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

function extractNodeImage(n: any): string | undefined {
  if (!n || !n.data) return undefined;
  const d = n.data;
  const candidates = [
    d.image,
    d.originalImage,
    d.inputData?.image,
    d.inputData?.imageUrl,
    d.inputData?.url,
    d.outputData?.image,
    d.outputData?.imageUrl,
    d.outputData?.url,
    d.imageUrl,
    d.url,
    d.src,
    d.compositeImage,
    d.maskImage,
    d.previewUrl,
    d.thumbnail,
    Array.isArray(d.images) ? d.images[0] : undefined,
    Array.isArray(d.refImages) ? d.refImages[0] : undefined,
    Array.isArray(d.referenceImages) ? d.referenceImages[0] : undefined,
    Array.isArray(d.layers) && d.layers[0] ? d.layers[0].image : undefined,
  ];

  for (const img of candidates) {
    if (typeof img === 'string' && img.trim().length > 5) {
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

/**
 * Load metadata for a single project file.
 * Prioritizes lightweight sidecar .meta.json files to avoid loading huge .ana project files across IPC.
 */
async function loadSingleProjectMeta(fp: string): Promise<ProjectMeta | null> {
  const metaPath = fp.replace(/\.ana$/i, '.meta.json');

  // 1. Check if lightweight .meta.json sidecar exists first
  try {
    const metaContents = await invokeWithTimeout<string>('load_file', { path: metaPath }, 800);
    if (metaContents && typeof metaContents === 'string' && metaContents.trim().startsWith('{')) {
      const m = JSON.parse(metaContents);
      return {
        filePath: fp,
        name: m.name || extractFilename(fp),
        status: m.status || 'completed',
        sourceCount: m.sourceCount ?? 0,
        outputCount: m.outputCount ?? 0,
        refCount: m.refCount ?? 0,
        totalNodes: m.totalNodes ?? 0,
        updatedAt: m.updatedAt || m.createdAt || Date.now(),
        createdAt: m.createdAt || Date.now(),
        thumbnailUrl: m.thumbnailUrl,
        promptSnippet: m.promptSnippet,
        modelTag: m.modelTag,
        hasImage: !!m.thumbnailUrl,
      };
    }
  } catch {
    // Sidecar doesn't exist or failed to load — proceed to read .ana file
  }

  // 2. Read .ana file with strict timeout protection
  try {
    const contents: string = await invokeWithTimeout<string>('load_file', { path: fp }, 2500);
    const wf: WorkflowFile = JSON.parse(contents);

    const nodes = Array.isArray(wf.nodes) ? wf.nodes : [];
    const edges = Array.isArray(wf.edges) ? wf.edges : [];

    const sourceNodes = nodes.filter(n => n.type === 'source' || n.data?.type === 'source');
    const outputNodes = nodes.filter(n => n.type === 'result' || n.data?.type === 'result' || (n.data?.type !== 'source' && (n.data?.image || n.data?.outputData?.image)));

    let thumbnailUrl: string | undefined = undefined;
    let promptSnippet: string | undefined = undefined;
    let modelTag: string | undefined = undefined;

    // Prioritize the FIRST input/source image
    for (const n of nodes) {
      const isSource =
        n.type === 'source' ||
        n.data?.type === 'source' ||
        n.data?.processingType === 'source' ||
        (typeof n.id === 'string' && n.id.toLowerCase().startsWith('source'));

      if (isSource) {
        const img = extractNodeImage(n);
        if (img) {
          thumbnailUrl = img;
          break;
        }
      }
    }

    // Fallback to any node with an image
    if (!thumbnailUrl) {
      for (const n of nodes) {
        const img = extractNodeImage(n);
        if (img) {
          thumbnailUrl = img;
          break;
        }
      }
    }

    // Extract prompt snippet & model tag
    for (const n of nodes) {
      if (!promptSnippet) promptSnippet = extractPrompt(n);
      if (!modelTag) modelTag = extractModelTag(n);
    }

    if (!thumbnailUrl && wf.thumbnail && typeof wf.thumbnail === 'string' && wf.thumbnail.length > 100) {
      thumbnailUrl = wf.thumbnail;
    }

    const hasImage = !!thumbnailUrl;
    const status: 'active' | 'draft' | 'completed' = outputNodes.length > 0 ? 'completed' : hasImage ? 'active' : 'draft';

    const project: ProjectMeta = {
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
    };

    // Asynchronously write sidecar for future instant loads
    invoke('save_file', {
      path: metaPath,
      contents: JSON.stringify(project, null, 2),
    }).catch(() => {});

    return project;
  } catch (err) {
    logger.warn('[ProjectService] Skipping corrupt file:', fp, err);
    // If the file contained malformed JSON, skip it as corrupt
    if (err instanceof SyntaxError) {
      return null;
    }
    // For timeouts (e.g. huge files exceeding IPC limits), return a safe fallback so the project still appears
    return {
      filePath: fp,
      name: extractFilename(fp),
      status: 'active',
      sourceCount: 1,
      outputCount: 0,
      refCount: 0,
      totalNodes: 1,
      updatedAt: Date.now(),
      createdAt: Date.now(),
      hasImage: false,
    };
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * List all saved projects from the projects directory with parallel loading and timeout safety
 */
export async function listProjects(): Promise<ProjectMeta[]> {
  let dir: string;
  try {
    dir = await getProjectsDir();
  } catch {
    return [];
  }

  let filePaths: string[];
  try {
    filePaths = await invokeWithTimeout<string[]>('list_dir', { path: dir, extension: 'ana' }, 3000);
  } catch {
    return [];
  }

  if (!Array.isArray(filePaths) || filePaths.length === 0) {
    return [];
  }

  // Load all projects in parallel
  const settled = await Promise.allSettled(filePaths.map(fp => loadSingleProjectMeta(fp)));
  const projects: ProjectMeta[] = [];

  for (const item of settled) {
    if (item.status === 'fulfilled' && item.value) {
      projects.push(item.value);
    }
  }

  // Sort by most recently updated
  projects.sort((a, b) => b.updatedAt - a.updatedAt);
  return projects;
}

/**
 * Delete a project file and its sidecar metadata
 */
export async function deleteProject(filePath: string): Promise<void> {
  await invoke('delete_file', { path: filePath });
  try {
    const metaPath = filePath.replace(/\.ana$/i, '.meta.json');
    await invoke('delete_file', { path: metaPath });
  } catch { /* ignore */ }
}

/**
 * Save workflow into the projects directory (quick save)
 */
export async function saveProjectToDir(
  name: string,
  workflow: WorkflowFile
): Promise<string> {
  const dir = await getProjectsDir();
  const safeName = name.replace(/[^\p{L}\p{N}_\-\s]/gu, '').trim() || 'untitled';
  const filePath = `${dir}\\${safeName}.ana`;
  const json = JSON.stringify(workflow, null, 2);
  await invoke('save_file', { path: filePath, contents: json });

  // Save sidecar .meta.json for instant listing without loading whole canvas
  try {
    const metaPath = `${dir}\\${safeName}.meta.json`;
    const nodes = Array.isArray(workflow.nodes) ? workflow.nodes : [];
    const edges = Array.isArray(workflow.edges) ? workflow.edges : [];
    let thumbnailUrl: string | undefined = undefined;
    for (const n of nodes) {
      thumbnailUrl = extractNodeImage(n);
      if (thumbnailUrl) break;
    }
    const meta = {
      name: workflow.name || safeName,
      createdAt: workflow.createdAt || Date.now(),
      updatedAt: workflow.updatedAt || Date.now(),
      totalNodes: nodes.length,
      sourceCount: nodes.filter(n => n.type === 'source' || n.data?.type === 'source').length,
      outputCount: nodes.filter(n => n.type === 'result' || n.data?.outputData?.image).length,
      refCount: edges.length,
      thumbnailUrl: thumbnailUrl || workflow.thumbnail,
      status: nodes.some(n => n.type === 'result') ? 'completed' : thumbnailUrl ? 'active' : 'draft',
      hasImage: !!(thumbnailUrl || workflow.thumbnail),
    };
    await invoke('save_file', { path: metaPath, contents: JSON.stringify(meta, null, 2) });
  } catch { /* non-critical */ }

  return filePath;
}

/**
 * Rename a project — updates the .name field inside the file and renames it
 */
export async function renameProject(filePath: string, newName: string): Promise<string> {
  const contents: string = await invoke('load_file', { path: filePath });
  const wf = JSON.parse(contents);
  wf.name = newName;
  wf.updatedAt = Date.now();
  const dir = await getProjectsDir();
  const safeName = newName.replace(/[^\p{L}\p{N}_\-\s]/gu, '').trim() || 'untitled';
  const newPath = `${dir}\\${safeName}.ana`;
  await invoke('save_file', { path: newPath, contents: JSON.stringify(wf, null, 2) });
  if (newPath !== filePath) {
    try { await invoke('delete_file', { path: filePath }); } catch { /* ignore */ }
    try {
      const oldMeta = filePath.replace(/\.ana$/i, '.meta.json');
      await invoke('delete_file', { path: oldMeta });
    } catch { /* ignore */ }
  }

  // Update sidecar
  try {
    const metaPath = `${dir}\\${safeName}.meta.json`;
    const meta = {
      name: newName,
      createdAt: wf.createdAt || Date.now(),
      updatedAt: wf.updatedAt || Date.now(),
      totalNodes: wf.nodes?.length || 0,
      thumbnailUrl: wf.thumbnail,
      status: 'active',
      hasImage: !!wf.thumbnail,
    };
    await invoke('save_file', { path: metaPath, contents: JSON.stringify(meta, null, 2) });
  } catch { /* ignore */ }

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
