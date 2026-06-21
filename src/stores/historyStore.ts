import { create } from 'zustand';
import type { HistoryEntry, HistoryGroup, FilterType, HistoryStats, SemanticProgress, NodeTreeData } from '../types/history';
import { 
  getHistory, 
  getHistoryStats, 
  clearHistory as apiClearHistory,
  deleteHistoryEntry,
  toggleStar as apiToggleStar
} from '../services/history/HistoryService';
import { groupHistoryEntries } from '../services/history/HistoryGroupingService';
import { CollectionService } from '../services/history/CollectionService';
import type { Collection } from '../services/history/CollectionService';

interface HistoryState {
  // State
  entries: HistoryEntry[];
  stats: HistoryStats;
  groupedGroups: HistoryGroup[];
  collections: Collection[];
  
  searchQuery: string;
  semanticQuery: string;
  selectedFilter: FilterType;
  selectedModel: string;
  sortAsc: boolean;
  
  selectMode: boolean;
  selectedIds: Set<string>;
  
  previewEntry: HistoryEntry | null;
  activeGroup: HistoryGroup | null;
  activeSmartCollectionId: string | null;
  isGroupedView: boolean;
  
  isSemanticLoading: boolean;
  semanticProgress: SemanticProgress | null;
  isSemanticModelError: boolean;
  useSemanticSearch: boolean;

  // Cache State
  workflowCache: Record<string, NodeTreeData>;
  timelineCache: Record<string, any[]>;

  // Actions
  refreshHistory: () => void;
  refreshCollections: () => void;
  
  setSearchQuery: (query: string) => void;
  setSemanticQuery: (query: string) => void;
  setSelectedFilter: (filter: FilterType) => void;
  setSelectedModel: (model: string) => void;
  setSortAsc: (sortAsc: boolean) => void;
  
  setSelectMode: (selectMode: boolean) => void;
  setSelectedIds: (ids: Set<string>) => void;
  toggleSelectId: (id: string) => void;
  toggleSelectAll: (filteredIds: string[]) => void;
  
  setPreviewEntry: (entry: HistoryEntry | null) => void;
  setActiveGroup: (group: HistoryGroup | null) => void;
  setActiveSmartCollectionId: (colId: string | null) => void;
  setIsGroupedView: (isGrouped: boolean) => void;
  
  setSemanticStatus: (loading: boolean, progress: SemanticProgress | null, error: boolean) => void;
  setUseSemanticSearch: (useSemantic: boolean) => void;
  
  toggleStar: (id: string) => void;
  deleteEntry: (id: string) => Promise<void>;
  deleteGroup: (rootSourceId: string) => Promise<void>;
  deleteSelectedEntries: () => Promise<void>;
  clearAllHistory: () => Promise<void>;

  // Cache Actions
  invalidateCache: () => void;
  
  // Collections Actions
  createCollection: (name: string) => string;
  addEntryToCollection: (colId: string, entryId: string) => void;
  removeEntryFromCollection: (colId: string, entryId: string) => void;
  deleteCollection: (colId: string) => void;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  // Initial State
  entries: [],
  stats: { total: 0, starred: 0, totalDuration: 0, types: {}, todayCount: 0 },
  groupedGroups: [],
  collections: [],
  
  searchQuery: '',
  semanticQuery: '',
  selectedFilter: 'all',
  selectedModel: 'all',
  sortAsc: false,
  
  selectMode: false,
  selectedIds: new Set<string>(),
  
  previewEntry: null,
  activeGroup: null,
  activeSmartCollectionId: null,
  isGroupedView: false,
  
  isSemanticLoading: false,
  semanticProgress: null,
  isSemanticModelError: false,
  useSemanticSearch: false,

  // Initial Cache State
  workflowCache: {},
  timelineCache: {},

  // Actions
  refreshHistory: () => {
    const entries = getHistory();
    const stats = getHistoryStats();
    const groupedGroups = groupHistoryEntries(entries);
    set({ entries, stats, groupedGroups });
  },

  refreshCollections: () => {
    set({ collections: CollectionService.load() });
  },

  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSemanticQuery: (semanticQuery) => set({ semanticQuery }),
  setSelectedFilter: (selectedFilter) => set({ selectedFilter, activeSmartCollectionId: null }),
  setSelectedModel: (selectedModel) => set({ selectedModel }),
  setSortAsc: (sortAsc) => set({ sortAsc }),
  
  setSelectMode: (selectMode) => set({ selectMode, selectedIds: new Set<string>() }),
  setSelectedIds: (selectedIds) => set({ selectedIds }),
  
  toggleSelectId: (id) => set((state) => {
    const next = new Set(state.selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    return { selectedIds: next };
  }),

  toggleSelectAll: (filteredIds) => set((state) => {
    const isAllSelected = state.selectedIds.size === filteredIds.length;
    return {
      selectedIds: isAllSelected ? new Set<string>() : new Set<string>(filteredIds)
    };
  }),

  setPreviewEntry: (previewEntry) => set({ previewEntry }),
  setActiveGroup: (activeGroup) => set({ activeGroup }),
  setActiveSmartCollectionId: (activeSmartCollectionId) => set({ activeSmartCollectionId, selectedFilter: 'pinboard' }),
  setIsGroupedView: (isGroupedView) => set({ isGroupedView }),
  
  setSemanticStatus: (isSemanticLoading, semanticProgress, isSemanticModelError) => 
    set({ isSemanticLoading, semanticProgress, isSemanticModelError }),
  setUseSemanticSearch: (useSemanticSearch) => set({ useSemanticSearch }),

  toggleStar: (id) => {
    apiToggleStar(id);
    get().refreshHistory();
  },

  deleteEntry: async (id) => {
    await deleteHistoryEntry(id);
    get().invalidateCache();
    get().refreshHistory();
    get().refreshCollections();
  },

  deleteGroup: async (rootSourceId) => {
    const { deleteHistoryGroup } = await import('../services/history/HistoryService');
    await deleteHistoryGroup(rootSourceId);
    set({ activeGroup: null });
    get().invalidateCache();
    get().refreshHistory();
    get().refreshCollections();
  },

  deleteSelectedEntries: async () => {
    const ids = Array.from(get().selectedIds);
    const results = await Promise.allSettled(ids.map(id => deleteHistoryEntry(id)));
    
    // Log failures if any
    results.forEach((res, i) => {
      if (res.status === 'rejected') {
        console.warn(`[HistoryStore] Failed to delete history entry ${ids[i]}:`, res.reason);
      }
    });

    set({ selectedIds: new Set<string>(), selectMode: false });
    get().invalidateCache();
    get().refreshHistory();
    get().refreshCollections();
  },

  clearAllHistory: async () => {
    await apiClearHistory();
    set({ selectedIds: new Set<string>(), selectMode: false, previewEntry: null, activeGroup: null });
    get().invalidateCache();
    get().refreshHistory();
    get().refreshCollections();
  },

  invalidateCache: () => {
    set({ workflowCache: {}, timelineCache: {} });
  },

  createCollection: (name) => {
    const col = CollectionService.create(name);
    get().refreshCollections();
    return col.id;
  },

  addEntryToCollection: (colId, entryId) => {
    CollectionService.addEntry(colId, entryId);
    get().refreshCollections();
  },

  removeEntryFromCollection: (colId, entryId) => {
    CollectionService.removeEntry(colId, entryId);
    get().refreshCollections();
  },

  deleteCollection: (colId) => {
    CollectionService.delete(colId);
    if (get().activeSmartCollectionId === colId) {
      set({ activeSmartCollectionId: null });
    }
    get().refreshCollections();
  }
}));

// Register global event listeners for automatic cache invalidation
if (typeof window !== 'undefined') {
  const handleInvalidate = () => {
    useHistoryStore.getState().invalidateCache();
  };
  window.addEventListener('history_updated', handleInvalidate);
  window.addEventListener('history_deleted', handleInvalidate);
  window.addEventListener('history_imported', handleInvalidate);
}
