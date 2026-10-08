import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMultiBuilderTabs } from './useMultiBuilderTabs';
import { SESSION_KEYS } from '../../../utils/storageKeys';

// Mock react-router-dom
const mockNavigate = vi.fn();
let mockLocation = { pathname: '/builder' };

vi.mock('react-router-dom', () => ({
  useLocation: () => mockLocation,
  useNavigate: () => mockNavigate,
}));

// Mock tauri core
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(null),
}));

// Mock tauri event
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

describe('useMultiBuilderTabs', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    mockLocation = { pathname: '/builder' };
    vi.clearAllMocks();
  });

  it('initializes with a default Untitled tab when storage is empty', () => {
    const { result } = renderHook(() => useMultiBuilderTabs());

    expect(result.current.tabs.length).toBe(1);
    expect(result.current.tabs[0].title).toBe('Untitled');
    expect(result.current.activeTabId).toBe(result.current.tabs[0].id);
  });

  it('immediately activates incoming project from sessionStorage and replaces clean untitled tab', () => {
    sessionStorage.setItem(SESSION_KEYS.OPEN_PROJECT_PATH, 'C:/Users/Projects/Sarii.ana');

    const { result } = renderHook(() => useMultiBuilderTabs());

    expect(result.current.tabs.length).toBe(1);
    expect(result.current.tabs[0].title).toBe('Sarii');
    expect(result.current.tabs[0].projectPath).toBe('C:/Users/Projects/Sarii.ana');
    expect(result.current.activeTabId).toBe(result.current.tabs[0].id);
    expect(sessionStorage.getItem(SESSION_KEYS.OPEN_PROJECT_PATH)).toBeNull();
  });

  it('appends project tab and activates it if an existing edited tab exists', () => {
    // Simulate an existing tab with unsaved/edited work
    const existingTab = {
      id: 'tab-existing',
      title: 'My Custom Sketch',
      projectPath: null,
      isDirty: true,
      everEdited: true,
    };
    localStorage.setItem('anarchy_builder_tabs', JSON.stringify([existingTab]));
    localStorage.setItem('anarchy_builder_active_tab', 'tab-existing');

    sessionStorage.setItem(SESSION_KEYS.OPEN_PROJECT_PATH, 'D:/Projects/Villa.ana');

    const { result } = renderHook(() => useMultiBuilderTabs());

    expect(result.current.tabs.length).toBe(2);
    expect(result.current.tabs[0].title).toBe('My Custom Sketch');
    expect(result.current.tabs[1].title).toBe('Villa');
    expect(result.current.activeTabId).toBe(result.current.tabs[1].id);
  });

  it('switches to existing tab if project is already opened in a tab', () => {
    const projectTab = {
      id: 'tab-villa',
      title: 'Villa',
      projectPath: 'D:/Projects/Villa.ana',
      isDirty: false,
      everEdited: false,
    };
    const otherTab = {
      id: 'tab-other',
      title: 'Other',
      projectPath: 'D:/Projects/Other.ana',
      isDirty: false,
      everEdited: false,
    };
    localStorage.setItem('anarchy_builder_tabs', JSON.stringify([otherTab, projectTab]));
    localStorage.setItem('anarchy_builder_active_tab', 'tab-other');

    sessionStorage.setItem(SESSION_KEYS.OPEN_PROJECT_PATH, 'D:/Projects/Villa.ana');

    const { result } = renderHook(() => useMultiBuilderTabs());

    expect(result.current.tabs.length).toBe(2);
    expect(result.current.activeTabId).toBe('tab-villa');
  });

  it('creates new tab and sets activeTabId to the new tab', () => {
    const { result } = renderHook(() => useMultiBuilderTabs());

    act(() => {
      result.current.createNewTab();
    });

    expect(result.current.tabs.length).toBe(2);
    const newestTab = result.current.tabs[1];
    expect(result.current.activeTabId).toBe(newestTab.id);
  });
});
