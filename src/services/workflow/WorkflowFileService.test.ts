import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Node, Edge } from '@xyflow/react';
import {
  saveWorkflow,
  saveWorkflowAs,
  loadWorkflow,
  getCurrentFilePath,
  setCurrentFilePath,
  resetFilePath,
} from './WorkflowFileService';

// Mock Tauri plugin dialog
vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn(),
  open: vi.fn(),
}));

// Mock HistoryService (IndexedDB image storage)
vi.mock('../history/HistoryService', () => ({
  getLocalImage: vi.fn(async (key: string) => {
    if (key === 'idb://existing-key') return 'data:image/png;base64,main-image-bytes';
    if (key === 'idb://existing-orig-key') return 'data:image/png;base64,orig-image-bytes';
    if (key === 'idb://existing-out-key') return 'data:image/png;base64,out-image-bytes';
    return null;
  }),
  cacheLocalImage: vi.fn(async () => {}),
}));

// Mock SettingsService
vi.mock('../settings', () => ({
  SettingsService: {
    get: vi.fn(() => 'C:\\MockSaveLocation'),
  },
}));

import { save, open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { getLocalImage, cacheLocalImage } from '../history/HistoryService';

describe('WorkflowFileService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFilePath();
    
    // Default mock behavior for invoke
    vi.mocked(invoke).mockImplementation(async (cmd) => {
      if (cmd === 'get_app_data_dir') return 'C:\\MockAppData';
      if (cmd === 'ensure_dir') return undefined;
      if (cmd === 'save_file') return undefined;
      return undefined;
    });
  });

  describe('State management', () => {
    it('sets, gets and resets active save file path', () => {
      expect(getCurrentFilePath()).toBeNull();
      setCurrentFilePath('C:\\my-project.ana');
      expect(getCurrentFilePath()).toBe('C:\\my-project.ana');
      resetFilePath();
      expect(getCurrentFilePath()).toBeNull();
    });
  });

  describe('saveWorkflow', () => {
    const nodes: Node[] = [
      {
        id: 'node-1',
        type: 'generate',
        position: { x: 10, y: 20 },
        data: {
          prompt: 'Test prompt',
          onExecute: () => {}, // Callback to be stripped
          image: 'idb://existing-key', // to be serialized to base64
        },
      },
    ];
    const edges: Edge[] = [
      { id: 'edge-1', source: 'node-1', target: 'node-2' },
    ];

    it('uses file dialog if no path is stored', async () => {
      vi.mocked(save).mockResolvedValue('C:\\NewProject.ana');

      const path = await saveWorkflow(nodes, edges, { name: 'NewProject' });
      expect(save).toHaveBeenCalledWith({
        defaultPath: 'C:\\MockSaveLocation\\NewProject.ana',
        filters: [{ name: 'Anarchy AI Project', extensions: ['ana'] }],
      });
      expect(path).toBe('C:\\NewProject.ana');
      expect(getCurrentFilePath()).toBe('C:\\NewProject.ana');
      expect(getLocalImage).toHaveBeenCalledWith('idb://existing-key');
      expect(invoke).toHaveBeenCalledWith('save_file', expect.objectContaining({
        path: 'C:\\NewProject.ana',
      }));
    });

    it('saves directly without dialog if path is stored', async () => {
      setCurrentFilePath('C:\\ExistingProject.ana');
      const path = await saveWorkflow(nodes, edges);
      
      expect(save).not.toHaveBeenCalled();
      expect(path).toBe('C:\\ExistingProject.ana');
      expect(invoke).toHaveBeenCalledWith('save_file', expect.objectContaining({
        path: 'C:\\ExistingProject.ana',
      }));
    });

    it('returns null if save dialog is cancelled', async () => {
      vi.mocked(save).mockResolvedValue(null);
      const path = await saveWorkflow(nodes, edges);
      expect(path).toBeNull();
    });
  });

  describe('saveWorkflowAs', () => {
    it('always triggers save dialog even if file path exists', async () => {
      setCurrentFilePath('C:\\OldPath.ana');
      vi.mocked(save).mockResolvedValue('C:\\NewPath.ana');

      const path = await saveWorkflowAs([], [], 'OldPath');
      expect(save).toHaveBeenCalled();
      expect(path).toBe('C:\\NewPath.ana');
    });
  });

  describe('loadWorkflow', () => {
    it('returns null if open dialog is cancelled', async () => {
      vi.mocked(open).mockResolvedValue(null);
      const res = await loadWorkflow();
      expect(res).toBeNull();
    });

    it('successfully loads, parses, and deserializes workflow', async () => {
      vi.mocked(open).mockResolvedValue('C:\\LoadedProject.ana');
      
      const fileContent = {
        signature: 'ANARCHY_AI_PROJECT_FILE',
        version: 1,
        fileVersion: 1,
        name: 'LoadedProject',
        nodes: [
          {
            id: 'n-1',
            type: 'result',
            position: { x: 50, y: 50 },
            data: {
              image: 'data:image/png;base64,some-new-image-data',
            },
          },
        ],
        edges: [
          { id: 'e-1', source: 'n-1', target: 'n-2' },
        ],
      };

      vi.mocked(invoke).mockImplementation(async (cmd, args: any) => {
        if (cmd === 'load_file' && args.path === 'C:\\LoadedProject.ana') {
          return JSON.stringify(fileContent);
        }
        return undefined;
      });

      const res = await loadWorkflow();
      expect(res).not.toBeNull();
      expect(res!.name).toBe('LoadedProject');
      expect(res!.filePath).toBe('C:\\LoadedProject.ana');
      expect(getCurrentFilePath()).toBe('C:\\LoadedProject.ana');
      
      // Node image should have been deserialized and cached
      expect(cacheLocalImage).toHaveBeenCalled();
      expect(res!.nodes[0].data.image).toMatch(/^idb:\/\//);
      expect(res!.edges).toHaveLength(1);
    });

    it('throws error if file signature is invalid', async () => {
      vi.mocked(open).mockResolvedValue('C:\\Corrupt.ana');
      vi.mocked(invoke).mockResolvedValue(JSON.stringify({
        signature: 'WRONG_SIGNATURE',
        version: 1,
        nodes: [],
        edges: [],
      }));

      await expect(loadWorkflow()).rejects.toThrow(/Invalid project file signature/);
    });

    it('throws error if workflow has no nodes or version', async () => {
      vi.mocked(open).mockResolvedValue('C:\\Corrupt.ana');
      vi.mocked(invoke).mockResolvedValue(JSON.stringify({
        signature: 'ANARCHY_AI_PROJECT_FILE',
        // version and nodes missing
      }));

      await expect(loadWorkflow()).rejects.toThrow(/Invalid workflow file format/);
    });
  });
});
