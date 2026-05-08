/**
 * AIConfig Store Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useAIConfigStore } from './aiConfigStore';
import type { AIConfig } from './aiConfigStore';

describe('aiConfigStore', () => {
  beforeEach(() => {
    useAIConfigStore.setState(useAIConfigStore.getInitialState());
  });

  describe('initial state', () => {
    it('should have correct initial config', () => {
      const config = useAIConfigStore.getState().config;
      expect(config.model).toBe('google/nano-banana-2');
      expect(config.steps).toBe(50);
      expect(config.cfg).toBe(7.5);
      expect(config.seed).toBeNull();
      expect(config.strength).toBe(0.75);
      expect(config.results).toBe(1);
    });
  });

  describe('setConfig', () => {
    it('should update config', () => {
      const { setConfig } = useAIConfigStore.getState();
      const newConfig: Partial<AIConfig> = { steps: 30, cfg: 10 };
      
      setConfig(prev => ({ ...prev, ...newConfig }));
      
      expect(useAIConfigStore.getState().config.steps).toBe(30);
      expect(useAIConfigStore.getState().config.cfg).toBe(10);
    });

    it('should merge with existing config', () => {
      const { setConfig } = useAIConfigStore.getState();
      
      setConfig(prev => ({ ...prev, steps: 30 }));
      
      expect(useAIConfigStore.getState().config.steps).toBe(30);
      expect(useAIConfigStore.getState().config.cfg).toBe(7.5); // unchanged
    });
  });

  describe('setSelectedNode', () => {
    it('should set selected node', () => {
      const { setSelectedNode } = useAIConfigStore.getState();
      const nodeInfo = { id: 'node-123', type: 'source' as const, image: 'url1', prompt: 'test prompt', state: 'idle' as const };
      
      setSelectedNode(nodeInfo);
      
      expect(useAIConfigStore.getState().selectedNode?.id).toBe('node-123');
    });

    it('should clear selected node when null passed', () => {
      const { setSelectedNode } = useAIConfigStore.getState();
      setSelectedNode({ id: 'node-123', type: 'source' as const, image: 'url1', prompt: 'test prompt', state: 'idle' as const });
      
      setSelectedNode(null);
      
      expect(useAIConfigStore.getState().selectedNode).toBeNull();
    });
  });

  describe('compareImages', () => {
    it('should set compare images', () => {
      const { setCompareImages } = useAIConfigStore.getState();
      const images = { A: 'url1', B: 'url2' };
      
      setCompareImages(images);
      
      expect(useAIConfigStore.getState().compareImages).toEqual(images);
    });

    it('should clear compare images when null passed', () => {
      const { setCompareImages } = useAIConfigStore.getState();
      setCompareImages({ A: 'url1', B: 'url2' });
      
      setCompareImages(null);
      
      expect(useAIConfigStore.getState().compareImages).toBeNull();
    });
  });

  describe('setCompareSlot', () => {
    it('should set slot A', () => {
      const { setCompareSlot } = useAIConfigStore.getState();
      
      setCompareSlot('A', 'url1');
      
      expect(useAIConfigStore.getState().compareImages?.A).toBe('url1');
    });

    it('should set slot B', () => {
      const { setCompareSlot } = useAIConfigStore.getState();
      
      setCompareSlot('B', 'url2');
      
      expect(useAIConfigStore.getState().compareImages?.B).toBe('url2');
    });
  });

  describe('isSwappedView', () => {
    it('should toggle isSwappedView', () => {
      const { setIsSwappedView } = useAIConfigStore.getState();
      
      setIsSwappedView(true);
      expect(useAIConfigStore.getState().isSwappedView).toBe(true);
      
      setIsSwappedView(false);
      expect(useAIConfigStore.getState().isSwappedView).toBe(false);
    });
  });

  describe('isPreviewExpanded', () => {
    it('should toggle isPreviewExpanded', () => {
      const { setIsPreviewExpanded } = useAIConfigStore.getState();
      
      setIsPreviewExpanded(true);
      expect(useAIConfigStore.getState().isPreviewExpanded).toBe(true);
      
      setIsPreviewExpanded(false);
      expect(useAIConfigStore.getState().isPreviewExpanded).toBe(false);
    });
  });

  describe('workflowSnapshot', () => {
    it('should set workflow snapshot', () => {
      const { setWorkflowSnapshot } = useAIConfigStore.getState();
      const snapshot = { nodes: [], edges: [] };
      
      setWorkflowSnapshot(snapshot);
      
      expect(useAIConfigStore.getState().workflowSnapshot).toEqual(snapshot);
    });
  });

  describe('getConfig', () => {
    it('should return current config', () => {
      const { getConfig, setConfig } = useAIConfigStore.getState();
      setConfig(prev => ({ ...prev, steps: 50 }));
      
      const config = getConfig();
      
      expect(config.steps).toBe(50);
    });
  });
});
