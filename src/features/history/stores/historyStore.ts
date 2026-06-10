import { create } from 'zustand';
import type { HistoryEntry, HistoryGroup, FilterType } from '../types';
import { 
  getHistory, 
  getHistoryStats, 
  clearHistory as apiClearHistory,
  deleteHistoryEntry,
  toggleStar as apiToggleStar
} from '../services/HistoryService';
import { groupHistoryEntries } from '../services/HistoryGroupingService';
import { CollectionService } from '../../../services/history/CollectionService';
import type { Collection } from '../../../services/history/CollectionService';

interface HistoryState {
  // State
  entries: HistoryEntry[];
  stats: any;
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
  semanticProgress: any;
  isSemanticModelError: boolean;

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
  
  setSemanticStatus: (loading: boolean, progress: any, error: boolean) => void;
  
  toggleStar: (id: string) => void;
  deleteEntry: (id: string) => Promise<void>;
  deleteSelectedEntries: () => Promise<void>;
  clearAllHistory: () => Promise<void>;
  
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

  toggleStar: (id) => {
    apiToggleStar(id);
    get().refreshHistory();
  },

  deleteEntry: async (id) => {
    await deleteHistoryEntry(id);
    get().refreshHistory();
    get().refreshCollections();
  },

  deleteSelectedEntries: async () => {
    const ids = Array.from(get().selectedIds);
    await Promise.all(ids.map(id => deleteHistoryEntry(id)));
    set({ selectedIds: new Set<string>(), selectMode: false });
    get().refreshHistory();
    get().refreshCollections();
  },

  clearAllHistory: async () => {
    await apiClearHistory();
    set({ selectedIds: new Set<string>(), selectMode: false, previewEntry: null, activeGroup: null });
    get().refreshHistory();
    get().refreshCollections();
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
