import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AIConfigProvider, useAIConfig } from './AIConfigContext';
import React from 'react';

// Wrapper component for the hook
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AIConfigProvider>{children}</AIConfigProvider>
);

describe('AIConfigContext', () => {
  it('should provide default config', () => {
    const { result } = renderHook(() => useAIConfig(), { wrapper });
    
    expect(result.current.config.model).toBe('google/nano-banana-2');
    expect(result.current.config.steps).toBe(50);
    expect(result.current.config.cfg).toBe(7.5);
  });

  it('should update config', () => {
    const { result } = renderHook(() => useAIConfig(), { wrapper });
    
    act(() => {
      result.current.setConfig(prev => ({ ...prev, steps: 100 }));
    });
    
    expect(result.current.config.steps).toBe(100);
  });

  it('should update selected node', () => {
    const { result } = renderHook(() => useAIConfig(), { wrapper });
    
    act(() => {
      result.current.setSelectedNode({ id: 'node-1', type: 'source', image: undefined, prompt: undefined, state: undefined });
    });
    
    expect(result.current.selectedNode.id).toBe('node-1');
    expect(result.current.selectedNode.type).toBe('source');
  });

  it('should set compare slot', () => {
    const { result } = renderHook(() => useAIConfig(), { wrapper });
    
    act(() => {
      result.current.setCompareSlot('A', 'https://example.com/image.jpg');
    });
    
    expect(result.current.compareImages.A).toBe('https://example.com/image.jpg');
  });

  it('should toggle preview expanded state', () => {
    const { result } = renderHook(() => useAIConfig(), { wrapper });
    
    expect(result.current.isPreviewExpanded).toBe(false);
    
    act(() => {
      result.current.setIsPreviewExpanded(true);
    });
    
    expect(result.current.isPreviewExpanded).toBe(true);
  });

  it('should toggle swapped view state', () => {
    const { result } = renderHook(() => useAIConfig(), { wrapper });
    
    expect(result.current.isSwappedView).toBe(false);
    
    act(() => {
      result.current.setIsSwappedView(true);
    });
    
    expect(result.current.isSwappedView).toBe(true);
  });
});
