import { useState, useEffect, useMemo } from 'react';
import { useHistoryStore } from '@/stores/historyStore';
import type { HistoryEntry } from '../types';
import { semanticSearch } from '@/services/history/SemanticSearchService';
import { groupHistoryEntries } from '@/services/history/HistoryGroupingService';

/** Evaluate rules for dynamic smart collections */
export function evaluateSmartCollection(colId: string, entries: HistoryEntry[]): HistoryEntry[] {
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  switch (colId) {
    case 'smart_top_10':
      // Top 10 images this month
      return entries
        .filter(e => e.timestamp >= thirtyDaysAgo)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 10);

    case 'smart_high_res':
      // Highest resolution or upscaled images
      return entries.filter(e => 
        e.type === 'upscale' || 
        (e.params?.width && e.params?.height && Number(e.params.width) * Number(e.params.height) >= 1024 * 1024)
      );

    case 'smart_reused': {
      // Prompts reused more than once
      const promptCounts = new Map<string, number>();
      entries.forEach(e => {
        if (e.prompt) {
          const p = e.prompt.trim().toLowerCase();
          promptCounts.set(p, (promptCounts.get(p) || 0) + 1);
        }
      });
      return entries.filter(e => e.prompt && (promptCounts.get(e.prompt.trim().toLowerCase()) || 0) > 1);
    }

    case 'smart_architectural':
      // Favorite architectural styles/renders
      return entries.filter(e => {
        const p = (e.prompt || '').toLowerCase();
        return p.includes('villa') || p.includes('house') || p.includes('architecture') || p.includes('building') || p.includes('interior') || p.includes('exterior') || p.includes('minimalist');
      });

    default:
      return [];
  }
}

export function useHistoryFilters() {
  const { 
    entries, 
    searchQuery, 
    semanticQuery, 
    setSemanticQuery,
    useSemanticSearch,
    selectedFilter, 
    selectedModel, 
    sortAsc, 
    collections, 
    activeSmartCollectionId,
    isGroupedView
  } = useHistoryStore();

  const [semanticResults, setSemanticResults] = useState<HistoryEntry[] | null>(null);
  const [isSemanticSearching, setIsSemanticSearching] = useState(false);

  // Debounce searchQuery into semanticQuery when useSemanticSearch is active
  useEffect(() => {
    if (!useSemanticSearch) {
      if (semanticQuery) {
        setSemanticQuery('');
      }
      return;
    }

    const handler = setTimeout(() => {
      setSemanticQuery(searchQuery);
    }, 450); // 450ms debounce to avoid overwhelming model inference

    return () => clearTimeout(handler);
  }, [searchQuery, useSemanticSearch, setSemanticQuery, semanticQuery]);

  // 1. Handle asynchronous semantic vector search matching
  useEffect(() => {
    if (!semanticQuery || !semanticQuery.trim()) {
      setSemanticResults(null);
      setIsSemanticSearching(false);
      return;
    }

    let active = true;
    setIsSemanticSearching(true);
    
    const runSearch = async () => {
      try {
        const results = await semanticSearch(semanticQuery, entries);
        if (active) {
          setSemanticResults(results.map(r => r.entry));
          setIsSemanticSearching(false);
        }
      } catch {
        if (active) {
          setSemanticResults([]);
          setIsSemanticSearching(false);
        }
      }
    };

    runSearch();
    return () => { active = false; };
  }, [semanticQuery, entries]);

  // 2. Perform standard keyword filtering and channel filters
  const filteredEntries = useMemo(() => {
    // Base entries list (either semantic search results or all entries)
    const base = semanticResults !== null ? semanticResults : entries;

    return base
      .filter(entry => {
        // Model Filter
        if (selectedModel && selectedModel !== 'all' && entry.model !== selectedModel) {
          return false;
        }

        // Category / Channel Filter
        if (selectedFilter === 'starred') {
          if (!entry.starred) return false;
        } else if (selectedFilter === 'pinboard') {
          if (!activeSmartCollectionId) return false;
          
          if (activeSmartCollectionId.startsWith('smart_')) {
            // Smart Collection Match
            const matched = evaluateSmartCollection(activeSmartCollectionId, entries);
            if (!matched.some(e => e.id === entry.id)) return false;
          } else {
            // Manual Collection Match
            const col = collections.find(c => c.id === activeSmartCollectionId);
            if (!col || !col.entryIds.includes(entry.id)) return false;
          }
        } else if (selectedFilter !== 'all' && entry.type !== selectedFilter) {
          return false;
        }

        // Standard Text Search Filter (only if semantic query is empty)
        if (!semanticQuery && searchQuery) {
          const q = searchQuery.toLowerCase();
          const matches = 
            entry.label.toLowerCase().includes(q) ||
            (entry.prompt && entry.prompt.toLowerCase().includes(q)) ||
            (entry.project && entry.project.toLowerCase().includes(q)) ||
            (entry.model && entry.model.toLowerCase().includes(q));
          if (!matches) return false;
        }

        return true;
      })
      .sort((a, b) => sortAsc ? a.timestamp - b.timestamp : b.timestamp - a.timestamp);
  }, [entries, semanticResults, searchQuery, semanticQuery, selectedFilter, selectedModel, sortAsc, collections, activeSmartCollectionId]);

  // 3. Perform dynamic source image grouping when grouped view is enabled
  const filteredGroups = useMemo(() => {
    if (!isGroupedView) return [];
    
    // Group only the filtered entries to keep searches and filter chips consistent in Grouped mode!
    return groupHistoryEntries(filteredEntries);
  }, [filteredEntries, isGroupedView]);

  return {
    filteredEntries,
    filteredGroups,
    isSemanticSearching
  };
}
