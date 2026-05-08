/**
 * Project Service
 * Manages saved .ana projects — list, open, delete, metadata
 */

import { invoke } from '@tauri-apps/api/core';
import type { WorkflowFile } from '../workflow/WorkflowFileService';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ProjectMeta {
  filePath: string;
  name: string;
  status: 'active' | 'draft' | 'completed';
  sourceCount: number;
  outputCount: number;
  refCount: number;
  updatedAt: number;
  createdAt: number;
  thumbnailUrl?: string;
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
  return file.replaceAll(/\.ana$/i, '');
}

function timeAgo(ts: number): string {
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
      
      const sourceNodes = wf.nodes.filter(n => n.data?.type === 'source');
      const outputNodes = wf.nodes.filter(n => n.data?.type === 'result' || n.data?.image);
      
      // Use saved thumbnail if available, otherwise fall back to first node image
      let thumbnailUrl: string | undefined = wf.thumbnail;
      if (!thumbnailUrl) {
        for (const n of wf.nodes) {
          const img = n.data?.image || n.data?.outputData?.image;
          if (img && typeof img === 'string') {
            thumbnailUrl = img;
            break;
          }
        }
      }

      const hasOutput = outputNodes.length > 0;

      projects.push({
        filePath: fp,
        name: wf.name || extractFilename(fp),
        status: hasOutput ? 'active' : 'draft',
        sourceCount: sourceNodes.length,
        outputCount: outputNodes.length,
        refCount: wf.edges.length,
        updatedAt: wf.updatedAt || wf.createdAt || 0,
        createdAt: wf.createdAt || 0,
        thumbnailUrl,
      });
    } catch (err) {
      console.warn('[ProjectService] Skipping corrupt file:', fp, err);
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
 * Get projects directory path
 */
export { getProjectsDir, timeAgo };
