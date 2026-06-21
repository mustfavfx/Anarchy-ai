/**
 * ProjectService unit tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import {
  getProjectsDir,
  listProjects,
  deleteProject,
  saveProjectToDir,
  renameProject,
  duplicateProject,
  timeAgo,
} from './ProjectService';

// Import mocked invoke to configure per-test behavior
vi.mocked(invoke);

const mockWorkflow = (overrides = {}): any => ({
  name: 'Test Workflow',
  nodes: [
    { type: 'source', data: { image: 'source-image-url' } },
    { type: 'result', data: { image: 'result-image-url' } },
  ],
  edges: [{ id: 'e1' }],
  createdAt: 100000,
  updatedAt: 200000,
  ...overrides,
});

describe('ProjectService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getProjectsDir', () => {
    it('returns projects directory path', async () => {
      vi.mocked(invoke).mockImplementation(async (cmd) => {
        if (cmd === 'get_app_data_dir') return 'C:\\MockAppData';
        if (cmd === 'ensure_dir') return undefined;
        return undefined;
      });

      const dir = await getProjectsDir();
      expect(dir).toBe('C:\\MockAppData\\projects');
      expect(invoke).toHaveBeenCalledWith('get_app_data_dir');
      expect(invoke).toHaveBeenCalledWith('ensure_dir', { path: 'C:\\MockAppData\\projects' });
    });
  });

  describe('listProjects', () => {
    it('returns an empty array when directory has no .ana files', async () => {
      vi.mocked(invoke).mockImplementation(async (cmd) => {
        if (cmd === 'get_app_data_dir') return 'C:\\MockAppData';
        if (cmd === 'ensure_dir') return undefined;
        if (cmd === 'list_dir') return [];
        return undefined;
      });

      const projects = await listProjects();
      expect(projects).toEqual([]);
    });

    it('successfully parses and lists project metadata', async () => {
      const wf1 = mockWorkflow({ name: 'Project A', updatedAt: 300000 });
      const wf2 = mockWorkflow({ name: 'Project B', updatedAt: 400000 });

      vi.mocked(invoke).mockImplementation(async (cmd, args: any) => {
        if (cmd === 'get_app_data_dir') return 'C:\\MockAppData';
        if (cmd === 'ensure_dir') return undefined;
        if (cmd === 'list_dir') return ['C:\\dir\\p1.ana', 'C:\\dir\\p2.ana'];
        if (cmd === 'load_file') {
          if (args?.path === 'C:\\dir\\p1.ana') return JSON.stringify(wf1);
          if (args?.path === 'C:\\dir\\p2.ana') return JSON.stringify(wf2);
        }
        return undefined;
      });

      const projects = await listProjects();
      expect(projects).toHaveLength(2);
      
      // Sorted by updatedAt descending, so wf2 (Project B) should be first
      expect(projects[0].name).toBe('Project B');
      expect(projects[0].sourceCount).toBe(1);
      // both nodes in mockWorkflow have an image or result type, so both are considered output
      expect(projects[0].outputCount).toBe(2);
      expect(projects[0].refCount).toBe(1);
      expect(projects[0].thumbnailUrl).toBe('source-image-url');

      expect(projects[1].name).toBe('Project A');
    });

    it('skips corrupt workflow files and continues listing', async () => {
      const wf = mockWorkflow({ name: 'Valid Project' });

      vi.mocked(invoke).mockImplementation(async (cmd, args: any) => {
        if (cmd === 'get_app_data_dir') return 'C:\\MockAppData';
        if (cmd === 'ensure_dir') return undefined;
        if (cmd === 'list_dir') return ['C:\\dir\\corrupt.ana', 'C:\\dir\\valid.ana'];
        if (cmd === 'load_file') {
          if (args?.path === 'C:\\dir\\corrupt.ana') return '{ corrupt: json ';
          if (args?.path === 'C:\\dir\\valid.ana') return JSON.stringify(wf);
        }
        return undefined;
      });

      const projects = await listProjects();
      expect(projects).toHaveLength(1);
      expect(projects[0].name).toBe('Valid Project');
    });
  });

  describe('deleteProject', () => {
    it('deletes the project file path', async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);
      await deleteProject('C:\\path\\project.ana');
      expect(invoke).toHaveBeenCalledWith('delete_file', { path: 'C:\\path\\project.ana' });
    });
  });

  describe('saveProjectToDir', () => {
    it('saves serialized project workflow into target path', async () => {
      vi.mocked(invoke).mockImplementation(async (cmd) => {
        if (cmd === 'get_app_data_dir') return 'C:\\MockAppData';
        if (cmd === 'ensure_dir') return undefined;
        if (cmd === 'save_file') return undefined;
        return undefined;
      });

      const wf = mockWorkflow();
      const path = await saveProjectToDir('My Special Name!!', wf);
      
      expect(path).toBe('C:\\MockAppData\\projects\\My Special Name.ana');
      expect(invoke).toHaveBeenCalledWith('save_file', {
        path: 'C:\\MockAppData\\projects\\My Special Name.ana',
        contents: JSON.stringify(wf, null, 2),
      });
    });
  });

  describe('renameProject', () => {
    it('updates name property and saves to new file name while deleting old file', async () => {
      const wf = mockWorkflow({ name: 'Old Name' });

      vi.mocked(invoke).mockImplementation(async (cmd) => {
        if (cmd === 'load_file') return JSON.stringify(wf);
        if (cmd === 'get_app_data_dir') return 'C:\\MockAppData';
        if (cmd === 'ensure_dir') return undefined;
        if (cmd === 'save_file') return undefined;
        if (cmd === 'delete_file') return undefined;
        return undefined;
      });

      const oldPath = 'C:\\MockAppData\\projects\\Old Name.ana';
      const newPath = await renameProject(oldPath, 'New Better Name');

      expect(newPath).toBe('C:\\MockAppData\\projects\\New Better Name.ana');
      
      // Loaded from old path
      expect(invoke).toHaveBeenCalledWith('load_file', { path: oldPath });
      
      // Saved to new path with updated name
      expect(invoke).toHaveBeenCalledWith('save_file', {
        path: newPath,
        contents: expect.stringContaining('"name": "New Better Name"'),
      });
      
      // Deleted old path
      expect(invoke).toHaveBeenCalledWith('delete_file', { path: oldPath });
    });
  });

  describe('duplicateProject', () => {
    it('duplicates file contents, appends suffix, and saves it', async () => {
      const wf = mockWorkflow({ name: 'Project' });

      vi.mocked(invoke).mockImplementation(async (cmd) => {
        if (cmd === 'load_file') return JSON.stringify(wf);
        if (cmd === 'get_app_data_dir') return 'C:\\MockAppData';
        if (cmd === 'ensure_dir') return undefined;
        if (cmd === 'save_file') return undefined;
        return undefined;
      });

      const newPath = await duplicateProject('C:\\MockAppData\\projects\\Project.ana');
      expect(newPath).toBe('C:\\MockAppData\\projects\\Project Copy.ana');
      
      expect(invoke).toHaveBeenCalledWith('save_file', {
        path: newPath,
        contents: expect.stringContaining('"name": "Project (Copy)"'),
      });
    });
  });

  describe('timeAgo', () => {
    it('returns text representations of time elapsed', () => {
      const now = Date.now();
      expect(timeAgo(now - 10 * 1000)).toBe('just now');
      expect(timeAgo(now - 5 * 60 * 1000)).toBe('5m ago');
      expect(timeAgo(now - 3 * 3600 * 1000)).toBe('3h ago');
      expect(timeAgo(now - 4 * 24 * 3600 * 1000)).toBe('4d ago');
    });
  });
});
