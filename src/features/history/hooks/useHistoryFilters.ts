import { useState, useEffect, useMemo, useRef } from 'react';
import { useHistoryStore } from '@/stores/historyStore';
import type { HistoryEntry } from '../types';
import { semanticSearch } from '@/services/history/SemanticSearchService';
import { groupHistoryEntries } from '@/services/history/HistoryGroupingService';
import { historyEngine } from '@/services/history/engine';

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

  // === History Engine v3.1: Trie Search Results ===
  const [trieResults, setTrieResults] = useState<HistoryEntry[] | null>(null);

  // Run Trie prefix search on every keystroke (instant, O(k))
  useEffect(() => {
    if (!searchQuery || !searchQuery.trim() || useSemanticSearch) {
      setTrieResults(null);
      return;
    }
    const results = historyEngine.search(searchQuery.trim());
    setTrieResults(results.length > 0 ? results : []);
  }, [searchQuery, useSemanticSearch]);

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
    }, 400);

    return () => clearTimeout(handler);
  }, [searchQuery, useSemanticSearch, semanticQuery, setSemanticQuery]);

  // Execute async Semantic Vector Search when semanticQuery changes
  useEffect(() => {
    if (!useSemanticSearch || !semanticQuery || !semanticQuery.trim()) {
      setSemanticResults(null);
      setIsSemanticSearching(false);
      return;
    }

    let isMounted = true;
    setIsSemanticSearching(true);

    semanticSearch(semanticQuery.trim(), entries)
      .then(results => {
        if (isMounted) {
          setSemanticResults(results);
          setIsSemanticSearching(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setSemanticResults([]);
          setIsSemanticSearching(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [semanticQuery, useSemanticSearch, entries]);

  // Combined Filter Pipeline
  const filteredEntries = useMemo(() => {
    // Priority 1: Smart Collection filter if selected
    let list: HistoryEntry[];
    if (activeSmartCollectionId) {
      list = evaluateSmartCollection(activeSmartCollectionId, entries);
    } else {
      list = entries;
    }

    // Priority 2: Search Query (Semantic or Trie or Text Include)
    if (useSemanticSearch && semanticQuery.trim()) {
      if (semanticResults !== null) {
        list = semanticResults;
      }
    } else if (searchQuery.trim()) {
      if (trieResults !== null) {
        list = trieResults;
      } else {
        const q = searchQuery.toLowerCase().trim();
        list = list.filter(e => 
          (e.prompt && e.prompt.toLowerCase().includes(q)) ||
          (e.model && e.model.toLowerCase().includes(q)) ||
          (e.id && e.id.toLowerCase().includes(q)) ||
          (e.tags && e.tags.some(t => t.toLowerCase().includes(q)))
        );
      }
    }

    // Filter by Tab (all, starred, variations, upscales, edits)
    if (selectedFilter !== 'all') {
      if (selectedFilter === 'starred') {
        list = list.filter(e => e.starred);
      } else if (selectedFilter === 'variations') {
        list = list.filter(e => e.type === 'variation' || e.nodeType === 'variation' || !!e.parentId);
      } else if (selectedFilter === 'upscales') {
        list = list.filter(e => e.type === 'upscale' || e.nodeType === 'upscale');
      } else if (selectedFilter === 'edits') {
        list = list.filter(e => e.type === 'edit' || e.type === 'canvas' || e.nodeType === 'edit');
      }
    }

    // Filter by AI Model
    if (selectedModel && selectedModel !== 'all') {
      list = list.filter(e => (e.model || e.params?.model || '') === selectedModel);
    }

    // Sort order (default: desc - newest first)
    const sorted = [...list].sort((a, b) => {
      const timeA = a.timestamp || 0;
      const timeB = b.timestamp || 0;
      return sortAsc ? timeA - timeB : timeB - timeA;
    });

    return sorted;
  }, [
    entries, 
    searchQuery, 
    semanticQuery, 
    useSemanticSearch, 
    semanticResults, 
    trieResults, 
    selectedFilter, 
    selectedModel, 
    sortAsc,
    activeSmartCollectionId
  ]);

  // Unique list of models for the model filter dropdown
  const availableModels = useMemo(() => {
    const modelSet = new Set<string>();
    entries.forEach(e => {
      const m = e.model || e.params?.model;
      if (m) modelSet.add(m);
    });
    return Array.from(modelSet);
  }, [entries]);

  // Grouped Entries (for grouped lineage view mode)
  const groupedEntries = useMemo(() => {
    if (!isGroupedView) return [];
    return groupHistoryEntries(filteredEntries);
  }, [filteredEntries, isGroupedView]);

  return {
    filteredEntries,
    groupedEntries,
    availableModels,
    isSemanticSearching
  };
}
